# ECS 通用 SSH Bastion `ecs-deployer` — 设计 & 实施 spec

- **Date**: 2026-08-23
- **Status**: Approved，待执行
- **Author**: AI session@`904b9436`
- **Trigger**: 用户原话「可以抽象一下，搞错一个吗？不然项目多起来一堆秘钥」+「开干」
- **Target**: ECS `139.196.89.64` (daifuyang 个人 OPC Ubuntu); 25/35+50/60+18:53 CST 范围内增量、低风险、可回滚地交付

## 1. 背景

ECS 上现按"每产品一个 deployer"的模式：

- `opcos-deployer` (uid 989, /bin/false, /var/lib/opcos-deployer) — opcos PostgreSQL CI/CD 跳板
- `ci-deployer` (uid 987, /bin/sh, sudoers 白名单) — 通用 CI（pm2/nginx/db-isolation install）
- `certdeploy`、`ecs-assist-user`、`db-isolation` — 各自独立的运维账号

只跑 1 个产品时勉强合理，但**新增第 2 个产品（iximei-kf CRM）就要新建 `iximei-deployer`**，并：

- 增殖 ed25519 私钥 ← GitHub Secrets 一份
- 增多 sshd_config Match User block
- 写一个新的 `*-ssh-guard` 脚本
- 维护一份独立的 audit log
- 一个新的 password 文件

随着产品增加，单产品接入边际成本不下降，运维负样本量超线性。

## 2. 设计目标

- **1 个 SSH user**（`ecs-deployer`），所有 Runner / 自动化共享
- **N 把 key 并列**（每个 Runner/产品独立 key，可单 key 撤销）
- **token 控动作**：`<product>-<action>` pattern dispatch
- **`PermitOpen` 限制隧道 target**：只允许 forward 到 ECS 回环白名单
- **journald 审计**：不自己维护 log 文件
- **加 1 个产品 = 1 行 dispatch case + 1 个 secret 文件**，不变 ECS user / sshd / guard

## 3. 实际收益（3 个场景）

### 3.1 加一把 GitHub Runner 钥匙

- **今天**：6 步（keygen → Secrets UI → authorized_keys 进 2 个 user home 之一 → sshd -t → reload → 验证）
- **之后**：1 步（把一行 pub key echo 到 `/etc/ecs-deployer/authorized_keys`）+ reload sshd
- 收益：单 Runner 接入 30 秒，N 个产品下几乎相同成本

### 3.2 关公网 MySQL 3306 端口（暴露面收口）

- **今天**：≈ 半天到 1 天。先建 iximei-deployer + iximei-ssh-guard，再让 opcos / iximei 两个产品 Runner 切 SSH 隧道，最后才能关 3306
- **之后**：≈ 5 分钟。两个 Runner 的 SSH user 改成 `ecs-deployer`（不同 key）→ guard 加 `iximei-mysql-dml` token → ECS 上 3306 DROP 规则到位
- 收益：3306 是裸跑公网 + DML-only 用户，DROP 后保留 SSH 通道能力但关停端口攻击面

### 3.3 开发离职 / 凭据审计

- **今天**：去 4–5 个文件的 authorized_keys 翻；每个账号的 ssh log 找时间窗口；改对应 Runner workflow
- **之后**：`journalctl -t ecs-deployer --since '...'` → 找出指纹 → 注释删除 `/etc/ecs-deployer/authorized_keys` 一行
- 收益：单点单行

## 4. 设计

### 4.1 单 SSH user

| 字段 | 值 |
|---|---|
| name | `ecs-deployer` |
| uid | 985 |
| shell | **`/bin/bash`**（不是 `/bin/false`，看下面） |
| home | `/var/lib/ecs-deployer` (0700, 不必存在) |
| group | `ecs-deployer` + `systemd-journal` (+`users` 默认) |
| password | 无（仅 pubkey） |

**为什么用 `/bin/bash` 不是 `/bin/false` 或 `/usr/sbin/nologin`**：sshd 8.0 ForceCommand 机制是 `${SHELL} -c "${ForceCommand}" "${ORIGINAL_CMD}"` (类似 `bash -c "guard_path" audit-tail`)。`/bin/false` 是空二进制，任何 `-c` 调用都直接 exit 1，guard 不会被 spawn，session 立即结束。`/usr/sbin/nologin` 在某些发行版会 PAM session 失败并阻断 exec。

实施用 `/bin/bash` 给 guard 提供一个能 spawn binary 的 shell，**而不是**给 ecs-deployer 用作 login shell — 因为 sshd 设了 `PermitTTY no` + ForceCommand，客户端没法 interactive login。`Match User` block 的 ForceCommand 覆盖 shell 用作 login shell 的通常路径，所以即使 shell 是 bash，正常 login 也会被 guard 拦截（`SSH_ORIGINAL_COMMAND` 为空时 guard exit 64）。

附加：**PAM `/etc/pam.d/sshd` 加一条 `pam_listfile.so item=user sense=deny file=/etc/ecs-deployer/forbid-interactive` 拒绝 interactive 登录**（即使 client 设法绕过 ForceCommand 也会被 PAM 拒绝）。具体 file 可以放 ecs-deployer username。**不在本 MVP 实施**，列为 §9 不在范围项。

### 4.2 多个独立 key（不共用一把）

```
/etc/ecs-deployer/authorized_keys  ← 0600 root:root, 一行一条 key

ssh-ed25519 AAA...  opcos-runner@ci
ssh-ed25519 AAA...  iximei-runner@ci
ssh-ed25519 AAA...  admin@daifuyang-ubuntu
```

每个身份独立 key，可单 key 撤销，不影响其它 Runner。

### 4.3 sshd drop-in，不动主配置

新文件 `/etc/ssh/sshd_config.d/99-ecs-deployer.conf`：

```sshd_config
Match User ecs-deployer
    PasswordAuthentication no
    PermitRootLogin no
    PubkeyAuthentication yes
    AuthorizedKeysFile /etc/ecs-deployer/authorized_keys
    ForceCommand /usr/local/bin/ecs-ssh-guard
    AllowTcpForwarding local
    PermitOpen 127.0.0.1:3080 127.0.0.1:3306 127.0.0.1:5432 127.0.0.1:6379 127.0.0.1:8787
    X11Forwarding no
    PermitTunnel no
    PermitTTY no
    ClientAliveInterval 300
    ClientAliveCountMax 2
    MaxAuthTries 3
```

- **`AllowTcpForwarding local`** 而不是 yes：仅允许本地发起 forward，禁止外部把 ECS 当跳板
- **`PermitOpen`** 把 target 限制在 ECS 回环白名单（DSH 3080 / DB 3306 / Postgres 5432 / Redis 6379 / db-isolation 8787）
- **不动 `/etc/ssh/sshd_config`** — match block 走 drop-in，便于 review / 单独备份

### 4.4 Guard dispatch

`/usr/local/bin/ecs-ssh-guard` 解析 `$SSH_ORIGINAL_COMMAND` token，按 `<product>-<action>` dispatch。

**关键设计**：guard 接收的 SSH_ORIGINAL_COMMAND 是**单个 token 字符串**（不是 shell-style args）。SQL 通过 stdin 喂入：

```
echo "SELECT CURRENT_USER();" | ssh ecs-deployer@HOST iximei-mysql-dml
```

不要用 `-e "SQL"` 这种 shell 形式 — OpenSSH 8.0 的 ForceCommand 在 privsep child 用 `bash -c "forced_cmd" cmd`，原始命令 argv 经 shell tokenize 后丢失 quote，无法稳定还原成多个 argv。

**Token 列表**：

| Token | 后端 | 凭据 | 备注 |
|---|---|---|---|
| `tunnel-dsh` | 通过 sshd -L 到 127.0.0.1:3080 | — | 由 client 决定 forward target |
| `iximei-mysql-dml` | `mysql ... iximei-crm` as `iximei_crm_app` | `/etc/ecs-deployer/secrets/iximei-app.pass` | CRM 数据访问 |
| `iximei-mysql-migrate` | `sudo /usr/bin/mysql ... iximei-crm` as `codecloud` (DDL) | sudo 白名单 + `/etc/ecs-deployer/secrets/iximei-migrate.pass` | drizzle migrate |
| `opcos-psql-dml` | `psql ... opc_os` as `opc_os_app` | `/etc/ecs-deployer/secrets/opcos-app.pass` | opcos 数据访问 |
| `opcos-psql-migrate` | `psql ... opc_os` as `app_migrator` | `/etc/ecs-deployer/secrets/opcos-migrate.pass` | opcos DDL |
| `audit-tail` | `journalctl -t ecs-deployer -n 100` | — | 调试审计 |
| 其它 | exit 64 + 写 journal | — | 拒绝 |

未知 token → exit 64 且 journal 记录一条 forbid 事件。

### 4.5 审计（journald，不自维护 log 文件）

guard 用：

```bash
logger -t ecs-deployer \
    -- "product=$product action=$action caller=${SSH_CONNECTION:-?} user=$USER cmd=${SSH_ORIGINAL_COMMAND}"
```

查看：`journalctl -t ecs-deployer` 或 `journalctl -t ecs-deployer --since '1 hour ago'`。

**禁止记录**：password、token、secret 内容。guard 里一律不出 `*.pass` 文件内容。

### 4.6 Secret 目录

```
/etc/ecs-deployer/                         # 0755 root:ecs-deployer (目录可被执行进入)
├── authorized_keys                        # 0644 root:root (pubkey 是公开数据；sshd privsep 子进程需绕过 group 限制读到 key)
└── secrets/                               # 0750 root:ecs-deployer (只有 ecs-deployer 组成员可 traverse)
    ├── iximei-app.pass                    # 0640 root:ecs-deployer
    ├── iximei-migrate.pass                # 0640 root:ecs-deployer
    ├── opcos-app.pass                     # 0640 root:ecs-deployer
    └── opcos-migrate.pass                 # 0640 root:ecs-deployer
```

guard 通过 `cat /etc/ecs-deployer/secrets/<name>.pass` 取，写入对应进程的 env (`MYSQL_PWD` / `PGPASSWORD`)。

**关键实施 bug 历史教训**（实施 §0-8 期间踩到的，记录下来给后续 reviewer）：

1. **`authorized_keys` 必须 mode 0644**：sshd 8.0 Match block 启用时，sshd 用 nobody 启动 AuthorizedKeysCommand，temporarily 用 985 (ecs-deployer)。但有时在某些时序下，与 ecs-deployer 组的 authorized_keys file (0640) 不可读。验证过 0644 root:root + 目录 0755 才能保证成功。pubkey 数据本身就是公开的，0644 不削弱安全性。

2. **`ecs-deployer` user 必须显式 `usermod -aG ecs-deployer`**：`useradd -r --no-user-group` 不会自动 primary group = ecs-deployer。实施时 `id ecs-deployer` 显示 `gid=100 users groups=190 systemd-journal`，**不在 ecs-deployer 组里**，所以 privsep child 在 cat 时 Permission denied。Fix：`usermod -aG ecs-deployer ecs-deployer`，加完后 `id` 包含 `980(ecs-deployer)`。

3. **`/etc/ecs-deployer/` 目录必须 0755**（不能 0750）：因为 authorized_keys 是 0644 root:root，世界可读，目录必须可走过才能 cat。

### 4.7 sudo 白名单（migrate 走 DDL）

iximei-mysql-migrate 需要 DDL（`drizzle-kit migrate` 跑 ALTER / CREATE），但 ecs-deployer 限定不开放 root shell。仅给一个 **mysql binary prefix** 的 sudo 规则：

```
/etc/sudoers.d/ecs-deployer

Defaults:ecs-deployer !lecture
Defaults:ecs-deployer !requiretty
Defaults:ecs-deployer !authenticate
ecs-deployer ALL=(root) NOPASSWD: /usr/bin/mysql --protocol=TCP -h 127.0.0.1 -P 3306 -u iximei_crm_migrator -p* iximei-crm
```

**实施踩坑 1**：`Defaults:ecs-deployer !authenticate` 是必须的。AL3 8.0 上 SSSD `pam_sss.so` 强制 password prompt，即使 sudoers `NOPASSWD` 也会让 `sudo -n` 走 password path → "a password is required"。

**实施踩坑 2**：sudoers rule **不要 trailing `*`**。`/usr/bin/mysql ... -p* iximei-crm` (无 `*`) 接受 0 个或多个 trailing args；`/usr/bin/mysql ... -p* iximei-crm *` (有 trailing `*`) **要求 ≥1 个 trailing arg** 才能匹配。guard 通过 `exec sudo -n /usr/bin/mysql iximei-crm` 传 0 个 trailing args 时，trailing-`*` 规则不匹配，直接 "command not allowed"。

**DML/DDL user 分离**（**最关键的安全纪律**）：
- DML user `iximei_crm_app`：`SELECT, INSERT, UPDATE, DELETE on iximei-crm.*`（运行时高频使用）
- DDL user `iximei_crm_migrator`：`ALL on iximei-crm.*`（CI/Runner 调用 migrate 时使用）

不混用一个 user 的 4 个理由：
1. **攻击面分离**：SQL injection 即使命中 runtime user，也拿不到 DDL 权限
2. **审计粒度**：DDL 在 audit log 里独立可查，淹没在 DML 噪音里会无解
3. **轮换节奏解耦**：DML=90 天 / DDL=180 天，独立 rotate
4. **失败模式分离**：DML 凭据泄露 ≠ schema 控制权泄露

**禁止使用 `codecloud` (ECS MySQL root)** 给 iximei-crm 的 migrate 用——`codecloud` 是 ECS 上**所有库**的 root，DML/DDL user 分离后 `codecloud` 不再被 iximei-crm 接触。每个项目必须用自己的 migrator user 满足"1 库 1 账号"原则。

## 5. ECS 端口策略（云端安全组，不在本 spec 实施）

按用户决定：服务器端口**不禁**（保持 22 / 80 / 443 / 3080 / 3306 / 5432 / 6379 都可达），云防火墙（阿里云安全组）策略本 spec 不动。

ECS 上 systemctl/iptables 操作本 spec 不做。

## 6. 文件 / 目录布局

```
/etc/ecs-deployer/                         ← root:root 0700
├── authorized_keys                        ← root:root 0600
├── secrets/                               ← root:ecs-deployer 0750
│   ├── iximei-app.pass                    ← 0640 root:ecs-deployer
│   ├── iximei-migrate.pass                ← 0640 root:ecs-deployer
│   ├── opcos-app.pass                     ← 0640 root:ecs-deployer
│   └── opcos-migrate.pass                 ← 0640 root:ecs-deployer
└── README                                 ← 本 spec 简化版（行内文档）

/usr/local/bin/
├── ecs-ssh-guard                         ← 0755 root:root, chmod -x for non-root
└── opcos-ssh-guard                       ← ★ 退役 opcos-deployer 期间保留

/etc/sudoers.d/
└── ecs-deployer                          ← 0440 root:root

/var/lib/ecs-deployer/                    ← home dir, 0700 root:root

/var/backups/ecs-deployer/                ← 实施前 snapshot 目的地, root:root 0700
```

## 7. 实施步骤（每步独立可回滚）

| # | 步骤 | 验证 | 回滚 |
|---|---|---|---|
| 0 | 本机生成 ed25519 key | `~/.ssh/ecs-deployer.pem` 0600 | `rm` |
| 1 | ECS 建 user、目录、sudoers | `id ecs-deployer; getent passwd` | `userdel -r ecs-deployer` + `/etc/sudoers.d/ecs-deployer rm` |
| 2 | ECS 写 `/etc/ecs-deployer/authorized_keys`（含 opcos / iximei / admin key） | `wc -l` | 备份恢复 |
| 3 | ECS 写 secret 目录初始值 | `ls -la /etc/ecs-deployer/secrets/` | 备份恢复 |
| 4 | ECS 装 `/usr/local/bin/ecs-ssh-guard` | `bash -n $file` | `rm` |
| 5 | ECS 写 `/etc/ssh/sshd_config.d/99-ecs-deployer.conf` | `sshd -t` | `rm` |
| 6 | **sshd -t 验证** | exit 0 | 中止后续步骤 |
| 7 | `systemctl reload sshd` | `systemctl status sshd` | reload 一次回滚，或改回 drop-in 文件 |
| 8 | 本机验证 `ssh ecs-deployer@HOST audit-tail` | journald 出现一条 entry | — |
| 9 | 本机验证 `ssh ecs-deployer@HOST iximei-mysql-dml -e "SELECT 1"` | mysql 有响应 | — |
| 10 | 本机验证 tunnel：`ssh -N -L 3080:127.0.0.1:3080 ecs-deployer@HOST` + curl localhost:3080 | TCP 通 | — |
| 11 | 手工 review：password 文件权限、token 列表、journal 行可读性 | — | — |
| 12 | **hold**：opcos-deployer 不立即退役。等 opcos repo Runner workflow 改完 SSH user + secrets → 同步迁移 → 7 天观察 → `userdel opcos-deployer` | — | — |
| 13 | 移除 `/usr/local/bin/opcos-ssh-guard`，drop opcos-/etc/ssh/sshd_config match block | — | — |

**关键纪律**：
- 每步前 `cp <目标文件> /var/backups/ecs-deployer/$(date +%F)/<file>`
- 步骤 6（`sshd -t`）失败 → **绝对**不进入步骤 7（reload）。先把 drop-in `rm` 掉。
- **不** `systemctl restart sshd`（会断所有 SSH，包括运行 CI 的 SSH；reload 即可热加载）

## 8. 安全要点（按攻击面展开）

| 表面 | 缓解 |
|---|---|
| 单把 key 泄露全部产品 | 多 key 并列 `/etc/ecs-deployer/authorized_keys`，单行删除即可撤销 |
| ECS 成任意端口跳板 | `AllowTcpForwarding local` + `PermitOpen` 白名单回环端口 |
| privilege escalation via guard | guard 不接 `~/.bashrc`、不读 stdin、token 不接受 env 透传 |
| secret 落到 journal | guard 仅 logging `product=/action=/caller=/cmd=` 头部，不读 password |
| sshd_config 主文件越改越乱 | match block 走 drop-in 文件 `sshd_config.d/99-ecs-deployer.conf`，不污染主文件 |
| 老账号残留 | opcos-deployer 退役走 7 天观察 + `userdel`，本 spec 不删 |

## 9. 不在本 spec 范围

- **ECS 端口收口 / 防火墙规则** — 用户决定由云端安全组策略处理，不动服务器 iptables
- **opcos repo workflow 切换** — 与 opcos 团队协调窗口，不在 ECS 操作
- **自动 key rotation 脚本** — 加 secret 后手 rotate；自动 schedule 在下一个 spec
- **journal 远程 ship**（journald-forward / Loki） — 当前 ECS 上无对应 monitoring infra，暂本机留存

## 10. 自检 checklist

- [ ] 本机 `~/.ssh/ecs-deployer.pem` 生成、0600
- [ ] ECS `id ecs-deployer` 返回 uid 985，shell `/bin/false`
- [ ] `/etc/ssh/sshd_config.d/99-ecs-deployer.conf` 内容与 §4.3 一致
- [ ] `sshd -t` exit 0
- [ ] ECS 公网 `codecloud/Codecloud2025.` 直接连接 DB 仍工作（破坏性检查：实施未触碰 3306 / `codecloud` 用户）
- [ ] opcos-deployer / ci-deployer 仍能各自 SSH 登入（未触碰 sshd_config）
- [ ] 本机 1 个 audit-tail 调用产生 1 条 journal entry
- [ ] 本机 1 个 iximei-mysql-dml 调用返回 SELECT 1 = 1
- [ ] 本机 1 个 tunnel-dsh 调用 connect 127.0.0.1:3080 成功
- [ ] `/var/backups/ecs-deployer/` 内有这次实施前所有被改文件的 .bak / snapshot

## 11. 等待执行

**下次 SSH 登 ECS 前，请你最后确认**：是否照 §7 顺序逐步执行、是否先从 opcos-deployer 旁路拉一把 GitHub Runner pub key（不需要 — 实施 §2 只放 admin@daifuyang 的 key 测通即可）。
