# iximei-kf FC 部署 Runbook

> **状态**: 2026-08-23 现行
> **范围**: `main` 分支 push 触发 `yishan-fullstack-cd-fc` workflow；DDL migrate 走 `yishan-fc-migrate`
> **所有凭证已脱敏**，原文参见 `~/.config/env-config/iximei-kf.yaml`

---

## 1. 顶层架构

```
main push ──► yishan-fullstack-cd-fc.yml
                │
                ├─ Admin (yishan-admin) 静态资源 ─► 七牛 CDN（/admin/*）
                └─ API (yishan-function)   ─────► 阿里云 FC 函数 yishan-crm

人工触发  ──► yishan-fc-migrate.yml
                │
                └─ 临时部署 yishan-migration-runner ── invoke ──► 跑 DDL/seed
```

- **生产域**: `crm.iximei.cn`
- **生产函数**: `yishan-crm` (region `cn-shanghai`)
- **临时函数**: `yishan-migration-runner` (每次 migrate 后 `s remove` 销毁)
- **证书**: `crm-iximei-cert` (阿里云 CAS, LE 由 cron 自动续)

---

## 2. 三条 workflow 总览

| Workflow | 触发 | 用途 | 入口 |
|---|---|---|---|
| `yishan-fullstack-cd-fc.yml` | push to `main` (apps/**) | 全栈部署：admin dist + API 函数 | 自动化 |
| `yishan-fc-migrate.yml` | workflow_dispatch (mode: dry-run/apply/reset-and-seed) | 跑 drizzle DDL + seed | 手动 |
| `yishan-cert-rotate-fc.yml` | cron `15 20 * * *` UTC + workflow_dispatch | Let's Encrypt cert 续签 | 自动 + 手动 |

**部署之间的依赖关系**:

```
cert-renew (auto, 每天 20:15 UTC)
     │
     ▼  生成新 cert version ──────────────────────► 阿里云 CAS
                                                        ▲
                                                        │ 下次 fullstack-cd 拉新 cert
                                                        │
yishan-fullstack-cd-fc (auto on push) ──── s deploy ──► FC 函数 yishan-crm
                                          │
                                          └─► Auto-run db:seed (轻量 RBAC 重绑)
                                                SEED_MINIMAL=true
                                                SEED_SKIP_MIGRATE=true
                                                SEED_SKIP_MODULE_MIGRATE=true

yishan-fc-migrate (manual) ──► s deploy yishan-migration-runner ──► s invoke
                                 │
                                 └─► 跑 drizzle-kit migrate (DDL)
                                     再 s remove 销毁
```

---

## 3. 触发条件

### 3.1 何时触发 fullstack-cd

- push 到 `main` 且路径命中:
  - `apps/**` (代码)
  - `apps/yishan-api/deploy/fc3/**` (FC 配置)
  - `pnpm-lock.yaml` / `package.json` / `pnpm-workspace.yaml`
- 例外: 文档/Markdown 改动不触发
- **手工触发**: GitHub UI → Actions → `yishan-fullstack-cd-fc` → Run workflow

### 3.2 何时触发 fc-migrate

**仅**当你需要动 schema 时手工跑:

- 加新表/索引/列到 `apps/yishan-api/src/modules/<x>/drizzle/*.sql`
- `db:generate` 出了新文件但 fullstack-cd 的 auto-seed **不会**跑 DDL
- 上线前通常先 `dry-run` 看 SQL，再 `apply` 确认 `APPLY`

⚠️ **不要**跑 `reset-and-seed` — 那是开发场景，会删生产数据。

### 3.3 何时触发 cert-rotate

- cron 每天 20:15 UTC = 北京时间次日 04:15
- cert 还有 > 30 天有效期 → cron 跳过
- cert < 30 天 → cron 自动: `acme.sh --issue --dns dns_ali` → `aic aliyun-cert:upload -p enterprise` → 更新 FC cert 配置
- **手工触发**: workflow_dispatch 两个 input:
  - `force_renew_cert=true` 强制 (绕过 30 天判断)
  - `use_staging=true` 用 LE staging server (不消耗 5 张/周 限速配额)

---

## 4. CD 部署步骤 (yishan-fullstack-cd-fc)

### Step 1 — 验证变量

`env:` 从 GitHub vars + secrets 注入。**严禁 hardcode 这些值进 repo**。

必填 vars (YISHAN_API environment):
- `FUNCTION_REGION`
- `FUNCTION_NAME`
- `FUNCTION_DESCRIPTION`
- `FUNCTION_VPC_ID`
- `FUNCTION_VSWITCH_ID`
- `FUNCTION_SECURITY_GROUP`
- (DDL workflow 还需 `MIGRATION_RUNNER_NAME` / `MIGRATION_RUNNER_DESCRIPTION`)

缺失任一 → workflow step 1 直接 fail。

### Step 2 — 准备 admin

1. checkout repo
2. setup node 22.22.1 + pnpm 8.15.9
3. `pnpm install --no-frozen-lockfile` (workspace 依赖)
4. `pnpm --filter yishan-tiptap exec max setup` (admin plugin 生成)
5. `pnpm --filter yishan-admin build` (产出 `apps/yishan-admin/dist`)
   - env `PUBLIC_PATH = vars.ADMIN_BASE_PATH || '/admin/'`
   - 资源路径以 `/admin/*` 前缀打包，对应 FC 函数挂载点

### Step 3 — 上传 admin 到七牛

- install qshell (`qshell v2.x linux-amd64/arm64`)
- 配置 `$HOME/.qshell.json` (mode 0600)
- `qshell qupload2 --src-dir apps/yishan-admin/dist --bucket <bucket> --key-prefix admin/ --overwrite --rescan-local --thread-count 4`
- 如 CDN 域名配置了: `qshell cdnrefresh --urls admin/index.html`

### Step 4 — 准备 API `.env`

`apps/yishan-api/.env` 由 workflow 写入。**CDN/FC 凭据**:
- `DATABASE_USER` / `DATABASE_PASSWORD` / `DATABASE_NAME` / `DATABASE_HOST` / `DATABASE_PORT` ← 来自 secrets
- `REDIS_URL` ← secret; workflow 用 node parse URL 拆 host/port/password/db
- `REDIS_HOST` ← var (vpc 内网)

### Step 5 — 配置 Serverless Devs

- install `@serverless-devs/s` globally
- `s config add --AccessKeyID <KEY_ID> --AccessKeySecret <KEY_SECRET> --AccountID <ACCOUNT_ID> -a enterprise -f`
  - 三者全部来自 secrets
  - AccountID 必须 16-32 位纯数字，否则 fallback 到 `-a enterprise` (无 AccountID)

### Step 6 — 恢复 layer lock

`apps/yishan-api/deploy/fc3/layer-lock.json` 从 cache 恢复 → 避免每次 publish 新 layer 版本 (pub 一次要等 1-2 分钟)。

### Step 7 — 编译 Runtime Layer

`apps/yishan-api/deploy/fc3/scripts/build-runtime-layer.sh`:
1. 生成 `package.json` (合并 workspace + `layer-dependencies.json`)
2. 计算 fingerprint (package.json + layer config hash)
3. `npm install --omit=dev` 到 `.build/runtime-layer/nodejs/`
4. zip 打包 → `runtime-layer.zip`

### Step 8 — 发布 Runtime Layer (按需)

- 比较 fingerprint vs lock: 不同 → 发布新版本
- 调用 `apps/yishan-api/deploy/fc3/scripts/publish-runtime-layer.sh`
- 提取 `YISHAN_API_RUNTIME_LAYER_ARN` (版本化的阿里云 ARN) → `steps.publish_layer.outputs.layer_arn`
- 更新 `layer-lock.json` 并 save cache

### Step 9 — 构造 Layered 函数代码

`apps/yishan-api/deploy/fc3/scripts/pre-deploy-layered.sh`:
1. (missing deps 时) `pnpm install`
2. `npm run db:generate` (产出 drizzle 元数据)
3. `npm run build:ts` (TS 编译 → `dist/`)
4. `cp -r dist/. $FUNCTION_DIR/` → `.build/function-code`
5. 清掉 `node_modules` / `package.json` / `package-lock.json` / `public` / `.env`
6. 生成 `function-code/package.json` (运行时依赖子集)
7. `npm install --omit=dev` 安装到 `function-code/`

### Step 10 — 部署 + 注入 Build Identity

`apps/yishan-api/deploy/fc3/scripts/deploy-layered-function.sh`:
1. **优先** 使用 `YISHAN_API_RUNTIME_LAYER_ARN` env var (来自 Step 8)
2. **fallback** 从 `layer-lock.json` 用 fingerprint 匹配
3. `s deploy -y -t deploy/fc3/templates/function.yaml`

环境变量 (注入到函数实例):
- **Build identity**: `YISHAN_API_VERSION=1.<GH_RUN_NUMBER>.0` / `GIT_COMMIT_SHA=<short>` / `BUILD_TIME=<UTC ISO8601>`
- **DB / Redis / JWT** (Secrets 注入)
- `ADMIN_BASE_PATH` (默认 `/admin/`)
- `TRUST_PROXY` (默认 `127.0.0.1/32,::1/128,21.0.0.0/8` — FC 内网网关段)
- `RUNTIME LAYER ARN` → 函数 runtime 用 layer

### Step 11 — Auto-run db:seed

仅 fullstack-cd 末尾 (after `if: success()`) 触发。**最小权限重绑 RBAC**:

env flags (都设 true):
- `ALLOW_PRODUCTION_SEED=true` — 允许跑 seed (默认 false)
- `SEED_MINIMAL=true` — 跳演示数据 (dict/post/region/option)
- `SEED_SKIP_MIGRATE=true` — 跳 core drizzle-kit migrate (fullstack-cd 期间不需要)
- `SEED_SKIP_MODULE_MIGRATE=true` — 跳模块 drizzle-kit migrate (走 fc-migrate 单独跑)

DB 走 `YISHAN_API_DATABASE_USER` (`iximei_crm_app`, DML-only). `iximei_crm_app` 权限 = `SELECT/INSERT/UPDATE/DELETE + CREATE/ALTER/INDEX/REFERENCES` + `allow_drop=false`, **够重绑 sys_role_menu + sys_role_permission 但不能 DROP 字段/表/索引**。

执行: `node dist/scripts/seed/index.js`

⚠️ **毛病**: 当前 user 是 `iximei_crm_app`, 而 **drizzle migrate 路径需要 root 账号** (db-isolation 给的 GRANT 不含 SUPER), 所以生产 DDL 永远不能走这里。要 DDL 走 fc-migrate workflow。

---

## 5. DDL 部署步骤 (yishan-fc-migrate)

### Step 1 — 验证变量 + 模式确认

mode options:
- `dry-run` (默认) — inspect pending migrations
- `apply` — 跑 pending migrations; 需要在 confirm field 输 `APPLY`
- `reset-and-seed` — 重建 DB; 需要在 confirm field 输 `RESET_AND_SEED`

⚠️ **永远不要** 在生产用 `reset-and-seed`。

### Step 2 — Build runner 包

`apps/yishan-api/deploy/fc3/scripts/prepare-migration-runner.sh` → 生成 `deploy/fc3/.build/migration-runner/`

### Step 3 — 部署 + invoke 临时 runner

1. `s deploy -t deploy/fc3/templates/runner.yaml -y`
2. `s invoke -t deploy/fc3/templates/runner.yaml --event '{"mode":"dry-run|apply"}' | tee /tmp/migration_invoke.log`
3. `grep -q '"error"' /tmp/migration_invoke.log` 失败则 fail
4. **success-only**: `s remove -t deploy/fc3/templates/runner.yaml -y`

runner 模板 (runner.yaml) 配置:
- handler: `infrastructure/migrations/runner.handler`
- timeout: **600 秒** (10 分钟, 跑 DDL 留余量)
- 注入 `DATABASE_*` + `ALLOW_PRODUCTION_SEED` + `SEED_ADMIN_PASSWORD`

### Step 4 — 验证

读 `/api/health` 或 `/api/build` 确认 YISHAN_API_VERSION 跟 workflow run 一致:

```bash
curl -sk https://crm.iximei.cn/api/build | jq .
```

返回:
```json
{
  "version": "1.<run_number>.0",
  "gitCommitSha": "<short_sha>",
  "buildTime": "<UTC ISO8601>"
}
```

如果 commit 跟 GH workflow run 对不上 → 部署没生效, 走 rollback。

---

## 6. 健康检查 (incident response)

### 6.1 函数不响应

```bash
# 看函数 invoke 错误日志
s cli fc3 function logs --function-name yishan-crm \
  --region cn-shanghai --tail 200

# 看 build identity
curl -sk https://crm.iximei.cn/api/build | jq .
```

### 6.2 返回 HTTP 412 (function exited)

通常 = schema 重复注册 / unhandled exception in handler. 走 invoke 日志查 `function stack trace`:
- 多次出现 → 代码 bug, 回滚到上一个 YISHAN_API_VERSION (rollback workflow 不存在, 需 manual `s deploy -y` 老 build artifact)
- 偶发 → cold start 慢, 重试

### 6.3 DB 连接失败

确认 vars 里 `DATABASE_HOST` 是不是 VPC 内网 (172.23.x.x), 不是公网 139.196.89.64 (生产**应该**走内网). 如果 vars 改公网说明 secret 配置错了。

### 6.4 audit / RBAC 看不到菜单

新代码加菜单后未走 seed:

```bash
# 手工 trigger seed 重绑 (轻量, 不动 DDL)
DATABASE_HOST=<vpc_host> DATABASE_USER=<user> DATABASE_PASSWORD=<pwd> \
DATABASE_NAME=iximei-crm REDIS_URL=<redis_url> REDIS_HOST=<redis_host> \
SEED_MINIMAL=true SEED_SKIP_MIGRATE=true SEED_SKIP_MODULE_MIGRATE=true \
ALLOW_PRODUCTION_SEED=true SEED_ADMIN_PASSWORD=<admin_pwd> \
node apps/yishan-api/dist/scripts/seed/index.js
```

或重新 push `main` (auto-seed 会在 Step 11 跑一次)。

---

## 7. Rollback 流程

**没有自动 rollback workflow**。Rollback 路径:

### 7.1 业务代码回滚

```bash
git revert <bad_commit>
git push origin main
# workflow 自动 deploy reverted code
```

### 7.2 Runtime Layer 回滚

```bash
# 通过阿里云 FC 控制台 → 函数 → 版本 → 切回上一个 layer 引用
# 或更新 layer-lock.json 指回旧版本 ARN, 然后 push 触发 redeploy
```

### 7.3 DDL 回滚

drizzle 不支持自动回滚。手工:
1. SSH 进 ECS (通过 ecs-deployer 跳板用 iximei-mysql-migrator token)
2. `mysql -h 127.0.0.1 -u codecloud -p` (root 账号)
3. 手工写 ROLLBACK sql (DROP TABLE / ALTER TABLE ...)
4. 同步更新 `__drizzle_migrations` (删 hash) 防止 drizzle 误判

### 7.4 函数整体回滚

```bash
# 列出最近版本
s cli fc3 version list --function-name yishan-crm --region cn-shanghai

# 切回老版本
s cli fc3 version set --function-name yishan-crm --version-id <old_version_id> \
  --region cn-shanghai
```

---

## 8. 凭据与 secret 清单 (脱敏)

### 8.1 GitHub Environment `YISHAN_API` vars

| Variable | 来源 / 含义 |
|---|---|
| `FUNCTION_REGION` | `cn-shanghai` |
| `FUNCTION_NAME` | `yishan-crm` |
| `FUNCTION_DESCRIPTION` | `Yishan CRM - crm.iximei.cn` |
| `FUNCTION_VPC_ID` | `vpc-uf65...zszs1db` |
| `FUNCTION_VSWITCH_ID` | `vsw-uf6f...wfioz1c2` |
| `FUNCTION_SECURITY_GROUP` | `sg-uf6b...uls3ism` |
| `MIGRATION_RUNNER_NAME` | `yishan-migration-runner` |
| `MIGRATION_RUNNER_DESCRIPTION` | `Database migration runner` |
| `REDIS_HOST` | VPC 内网 Redis IP |
| `CERT_NAME` | `crm-iximei-cert` |
| `CUSTOM_DOMAIN` | `crm.iximei.cn` |
| `ADMIN_BASE_PATH` | `/admin/` |
| `ADMIN_REDIRECT_ROOT` | `true` |

### 8.2 GitHub Environment `YISHAN_API` secrets

| Secret | 用途 | 谁消费 |
|---|---|---|
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | 阿里云 enterprise 主账号 AK | all workflows |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 同上 SK | all workflows |
| `ALIBABA_CLOUD_ACCOUNT_ID` | 阿里云主账号 ID (16 位) | all workflows |
| `YISHAN_API_DATABASE_HOST` | VPC 内网 MySQL IP | fullstack-cd, fc-migrate |
| `YISHAN_API_DATABASE_PORT` | `3306` | 同上 |
| `YISHAN_API_DATABASE_NAME` | `iximei-crm` | 同上 |
| `YISHAN_API_DATABASE_USER` | `iximei_crm_app` (DML-only) | 同上 |
| `YISHAN_API_DATABASE_PASSWORD` | DML-only 密码 | 同上 |
| `YISHAN_API_REDIS_URL` | `redis://:<pwd>@<vpc_host>:6379/0` | fullstack-cd |
| `YISHAN_API_JWT_SECRET` | 64-char hex, JWT 签名 | fullstack-cd |
| `YISHAN_API_SEED_ADMIN_PASSWORD` | seed 后 admin user 的密码 | fullstack-cd, fc-migrate |
| `QINIU_ACCESS_KEY` | 七牛 AK | fullstack-cd |
| `QINIU_SECRET_KEY` | 七牛 SK | fullstack-cd |
| `QINIU_BUCKET` | `ai-code` | fullstack-cd |
| `QINIU_CDN_DOMAIN` | 七牛 CDN 域名 | fullstack-cd |
| `ALI_DNS_ACCESS_KEY_ID` | 阿里云 DNS-01 (personal) | cert-rotate |
| `ALI_DNS_ACCESS_KEY_SECRET` | 同上 SK | cert-rotate |

### 8.3 ECS MySQL users

| User | 权限 | 用途 |
|---|---|---|
| `codecloud` | ALL (root) | 应急手动 DDL — **不被 iximei-crm 接触** (按 DML/DDL 分离原则) |
| `iximei_crm_app` | SELECT/INSERT/UPDATE/DELETE + CREATE/ALTER/INDEX/REFERENCES (allow_drop=false) | fullstack-cd auto-seed + API runtime |
| `iximei_crm_migrator` | ALL on iximei-crm.* | fc-migrate DDL (走 ecs-deployer SSH tunnel + sudo /usr/bin/mysql) |

### 8.4 阿里云资源

- **FC 函数**: `yishan-crm` (region cn-shanghai), runtime custom.debian12, 1 vCPU / 2048 MB / 512 MB disk, instanceConcurrency 100
- **临时函数**: `yishan-migration-runner` (fc-migrate workflow 部署 / 销毁)
- **Serverless Layer**: `yishan-api-runtime-layer` (版本化, 引用 lock 在 `apps/yishan-api/deploy/fc3/layer-lock.json`)
- **CAS 证书**: `crm-iximei-cert` (aliyun cert id, 由 cert-rotate workflow 更新)
- **CDN**: 七牛 bucket `ai-code` (key-prefix `admin/`)

---

## 9. 易踩坑 (Troubleshooting Cheatsheet)

| 现象 | 原因 | 修复 |
|---|---|---|
| HTTP 412 + Function exited | 函数冷启动失败 / schema 重复注册 / handler throw | 看 invoke 日志 + grep `error`; 多数情况是代码 bug → git revert + push |
| Cert 续签 ETIMEDOUT | aic 0.1.2-dev.2 内置 timeout=120000ms 太短 | cert-rotate workflow 走 `acme.sh --issue --dns dns_ali`, 不经 aic |
| Auto-seed 失败 `permission denied` | seed 路径要 DDL 但 iximei_crm_app 是 DML-only | 真 DDL 走 fc-migrate; 菜单 RBAC 重绑也走 fc-migrate |
| 镜像 OOM | runtime-layer npm install 用 `--omit=dev` 漏掉 peer dep | 看 layer build log |
| 函数 invoke 503 cold start | Custom runtime 冷启动 ~3s | 必要时开预热并发, 或者调 instanceConcurrency |
| qshell CDN 刷新失败 | CDN 域名配置错 | `qshell cdnrefresh -i <urls>` 单文件试 |

---

## 10. 关键文件位置 (本地 repo)

```
.github/workflows/
  yishan-fullstack-cd-fc.yml        # 全栈部署 (push 触发)
  yishan-fc-migrate.yml            # DDL 部署 (手动 dispatch)
  yishan-cert-rotate-fc.yml        # 证书续签 (cron + 手动)
  yishan-crm-cd-fc.yml             # 旧证书 workflow (兼容保留)

apps/yishan-api/
  deploy/fc3/
    scripts/
      build-runtime-layer.sh        # 编译 layer (Step 7)
      pre-deploy-layered.sh         # 准备函数代码 (Step 9)
      deploy-layered-function.sh    # s deploy + 注入 build identity (Step 10)
      publish-runtime-layer.sh      # 发布 layer (Step 8)
      prepare-migration-runner.sh   # 准备 migration runner (DDL Step 2)
      lib/                          # layer fingerprint, write-package helpers
    templates/
      function.yaml                 # yishan-function FC 模板
      runner.yaml                   # yishan-migration-runner FC 模板 (临时)
      domain.yaml                   # 域名绑定 (cert-rotate workflow 引用)
    config/
      layer-dependencies.json       # layer 依赖白名单
    .build/                         # build 产物 (gitignored)
    layer-lock.json                 # 锁定当前 layer ARN (cache)

apps/yishan-admin/
  dist/                            # build 产物 (gitignored, 上传到七牛)
```
