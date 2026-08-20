# 医院账号登录失败根因（代码静态分析）

> 日期：2026-07-28
> 任务：Task 6 / Phase A.3 — 医院账号诊断/修复脚本 + 根因报告
> 关联脚本：
> - `scripts/diagnose-hospital-accounts.sql` — 5 段只读 SELECT（4 段排查 + 1 段辅助）
> - `scripts/fix-hospital-accounts.ts` — dry-run 默认；`--apply` 才写入

## 与 brief 假设的差异（必须先看）

brief 假定本项目用 **bcrypt** (`$2a$...`)，对应诊断里 `WHERE password_hash NOT LIKE '$2%'`。

**实际：本项目 2026-07 的密码方案是 scrypt v1**，不是 bcrypt：

- 见 `apps/yishan-api/src/utils/password.ts:hashPassword`，输出格式：
  ```
  $scrypt$v=1$ln=16,r=8,p=2$<salt-base64url>$<key-base64url>
  ```
- 老 iximei 数据兼容格式：`###` + 32 位 hex，由 `apps/yishan-api/src/utils/legacy-password.ts::verifyLegacyPassword` 处理（仅当 `sys_user.password_format = 0`）。
- `sys_user.password_format` 是用户级标记（0=老 iximei，1=scrypt v1）。

因此本任务的诊断/修复脚本以 **scrypt v1 + 老 iximei** 两种合法格式为准；其他（包括 `$2...` bcrypt、`md5(...)`、明文、空值）一律视为异常。

## 可能根因（按概率）

1. **孤儿医院 `crm_hospital.account_user_id IS NULL`** — 理论上 schema 是 `NOT NULL + FK`（见 `apps/yishan-api/src/modules/crm/db/schema.ts:crmHospital.accountUserId`），不应出现；但历史手工修复、迁移脚本异常、跨环境数据搬运可能导致。孤儿医院在登录页查不到账号自然登不上。
2. **账号被禁用但医院仍启用**：`sys_user.status = 0` 或 `deleted_at IS NOT NULL`，但 `crm_hospital.status = 1`。登录 service 会因状态校验拒绝。
3. **passwordHash 算法不匹配**：理论上不应发生（`hashPassword` / `verifyPassword` 同源）。但
   - 老 iximei 数据导入时 `passwordFormat` 没设成 0，登录路径回退失败；
   - 或外部脚本/手工 SQL 直接写了非 scrypt 也非 `###` 格式的 hash（如某个老版本 hash、调试值）；
   - 或 hash 字段被 `NULL` / 空串覆盖。
4. **重复 username**：与"一院一账号"约定冲突；登录按 `username` 查时若未加 `deleted_at IS NULL` 过滤，可能命中错误记录。

## 排查流程

1. 跑诊断 SQL 看 4 段统计结果：
   ```bash
   mysql -h <host> -u <user> -p <dbname> < scripts/diagnose-hospital-accounts.sql
   ```
   重点看：
   - 第 1 段 = 0：说明账号绑定数据正常；
   - 第 2 段 > 0：必须先 `enable` 这些账号或与运营确认是否要软删医院；
   - 第 3 段 > 0：这些账号登录 100% 失败，需要 DBA 重置密码（脚本不自动重置）；
   - 第 4 段 > 0：检查是哪批历史数据，并核对登录 service 是否漏过滤 `deleted_at`。

2. **必须 dry-run 一次再决定是否 apply**：
   ```bash
   pnpm --filter yishan-api exec tsx ../../scripts/fix-hospital-accounts.ts \
        --default-password 'Temp@12345'
   ```
   - 默认输出 `== DRY-RUN ==`，脚本打印"将做什么"但不写入；
   - 看到日志里的 `created=N` / `enabled=N` 与期望一致后再加 `--apply`；
   - 第 3 段（非合规 hash）脚本只会打印列表，不会自动重置。

3. `--apply` 模式：
   - **孤儿医院**：在同一事务里 INSERT `sys_user`（`passwordHash = scrypt('--default-password')`, `passwordFormat = 1`, `passwordChangeRecommended = 1`, `status = 1`）+ INSERT `sys_user_role(user_id, role_id = HOSPITAL_ACCOUNT = 3)` + UPDATE `crm_hospital.account_user_id`。
   - **禁用账号**：UPDATE `sys_user SET status = 1, deleted_at = NULL, version = version + 1`。
   - **非合规 hash**：只打印待 DBA 处理；建议 DBA 用系统管理工具重置并通知用户。

   `HOSPITAL_ROLE_ID` 默认 3，对齐 `apps/yishan-api/src/constants/permission-codes.ts::ROLE_IDS.HOSPITAL_ACCOUNT`。若生产环境的 ID 不同，可用 `--hospital-role-id N` 覆盖。

4. 修复后用 `auth/login` 真实账户验证一遍。

## 代码侧建议（不在本任务范围内，仅记录）

- `apps/yishan-api/src/core/plugins/external/db-error.ts`：启动时打印 `orphan hospital count` warning，便于 ops 一眼看出数据漂移。
- `apps/yishan-api/src/utils/password.ts::verifyPassword`：增加 `verifyPasswordThrows` 包装器（try/catch + 日志），当 hash 解析失败时给出明确错误，便于排查"为啥某用户登不上"。
- `crm_hospital.account_user_id` 当前 schema 是 `NOT NULL` + FK，但 `apps/yishan-api/src/modules/crm/db/schema.ts` 注释已经标注"Drizzle 不在生成列约束时强制外键"。建议在迁移脚本里手动 `ALTER TABLE crm_hospital ADD CONSTRAINT ...` 兜底，避免 Drizzle 漂移。

## 已知风险与未覆盖

- **脚本未跑 `tsc` 验证**：脚本是 ad-hoc 工具，依赖 `mysql2`（已在 `apps/yishan-api/package.json` dependencies）+ Node 内置 `crypto`，**未引入新依赖**。`tsx` 运行时可在 `apps/yishan-api` 里 `pnpm exec tsx` 调用。本任务约束是"不跑 `pnpm install`"，故没有把它纳入根 monorepo 的 `tsconfig`；运行方需要从 `apps/yishan-api` 目录起 tsx 才能借到它的 node types + tsx 配置。
- **环境变量**：脚本读 `DATABASE_URL`（与后端一致），默认值 `mysql://root:root@localhost:3306/yishan`。生产环境请注入真实的 URL（与 `apps/yishan-api/.env` 一致），不要直接用默认值。
- **孤儿医院 username 冲突**：如果某医院的 `hospital_name` 已被某个 `sys_user.username` 占用（极端情况：手工改过 hospital_name 而老账号仍在），脚本会跳过并在日志里写明原因，**不会**强行覆盖旧账号。处理方式是先用人工 SQL 处理冲突后再跑脚本。
- **密码默认值安全性**：脚本默认要求传 `--default-password`，且故意在 dry-run 也接受它（便于 dry-run 时把将要生成的 hash 写入 preview）。**建议 DBA 临时生成一个 16 位强随机串**，登录后强制用户改密（`passwordChangeRecommended = 1` 已经在 sys_user 行上）。

## 小结

绝大多数医院账号登录异常都可以归到上面 4 个根因之一。先用 `diagnose-hospital-accounts.sql` 跑一遍拿到具体计数，再用 `fix-hospital-accounts.ts --apply` 处理 1、2 类异常，第 3 类交给 DBA。schema 已经做了 `NOT NULL` + FK，理论上长期不会再产生孤儿医院，但建议加启动自检日志持续兜底。