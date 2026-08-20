-- scripts/diagnose-hospital-accounts.sql
--
-- 只读诊断脚本：医院账号登录异常排查。**不会修改任何数据**。
--
-- 使用方式：
--   mysql -h <host> -u <user> -p <dbname> < scripts/diagnose-hospital-accounts.sql
-- 或在 MySQL CLI 里 SOURCE scripts/diagnose-hospital-accounts.sql;
--
-- 注意：本项目新密码 hash 格式是 `$scrypt$v=1$ln=16,r=8,p=2$...`（参考
-- apps/yishan-api/src/utils/password.ts::hashPassword），不是 bcrypt。
-- 老 iximei 数据用 `###` + 32 位 hex 表示（password_format=0）。
-- 本脚本会把"非新格式且非老格式"的 hash 视作异常，需要 DBA 介入。
--
-- 表名约定参考 apps/yishan-api/src/modules/crm/db/schema.ts (crm_hospital)
-- 和 apps/yishan-api/src/db/schema/tables.ts (sys_user / sys_user_role / sys_role)。

-- ──────────────────────────────────────────────────────────────
-- 1) 医院没有绑定账号（理论上 schema NOT NULL + FK 不允许，但
--    历史数据/手工修复后可能产生）
-- ──────────────────────────────────────────────────────────────
SELECT h.id, h.hospital_name, h.deleted_at, h.status, h.account_user_id
FROM crm_hospital h
WHERE h.account_user_id IS NULL;

-- ──────────────────────────────────────────────────────────────
-- 2) 账号被禁用 / 已删但医院仍 active —— 登录会失败
-- ──────────────────────────────────────────────────────────────
SELECT h.id, h.hospital_name, h.status AS hospital_status,
       u.id AS user_id, u.username, u.status AS user_status,
       u.deleted_at AS user_deleted_at, u.password_format
FROM crm_hospital h
LEFT JOIN sys_user u ON u.id = h.account_user_id
WHERE h.status = 1
  AND (u.status IS NULL OR u.status <> 1 OR u.deleted_at IS NOT NULL);

-- ──────────────────────────────────────────────────────────────
-- 3) 密码 hash 既不是 scrypt v1 也不是老 iximei `###...` 格式
--    （如 `$2a$...` bcrypt、纯 md5、明文、空值都属此列）
-- ──────────────────────────────────────────────────────────────
SELECT u.id, u.username, u.password_format,
       LEFT(u.password_hash, 16) AS hash_prefix,
       CHAR_LENGTH(u.password_hash) AS hash_len
FROM sys_user u
WHERE u.password_hash IS NULL
   OR u.password_hash = ''
   OR (
     u.password_hash NOT LIKE '$scrypt$v=1$%'
     AND u.password_hash NOT LIKE '###%'
   );

-- ──────────────────────────────────────────────────────────────
-- 4) 重复 username —— 与"一院一账号"约定冲突，登录可能命中错误行
-- ──────────────────────────────────────────────────────────────
SELECT username, COUNT(*) AS cnt
FROM sys_user
WHERE deleted_at IS NULL
GROUP BY username
HAVING cnt > 1;

-- ──────────────────────────────────────────────────────────────
-- 5) 辅助：未被医院绑定的活跃账号（孤儿账号）—— 排查账号冗余
-- ──────────────────────────────────────────────────────────────
SELECT u.id, u.username, u.real_name, u.status, u.last_login_time
FROM sys_user u
LEFT JOIN crm_hospital h ON h.account_user_id = u.id
WHERE h.id IS NULL
  AND u.deleted_at IS NULL
  AND u.status = 1
ORDER BY u.id DESC
LIMIT 50;