-- 一院一账号 breaking change: sys_user.username NOT NULL.
--
-- 与 0002 / 0003 一样, 不通过 drizzle-kit 生成/迁移, 而手写幂等 SQL。
-- 本次仅在 Core schema 已加 .notNull() 后, 同步物理列约束。
--
-- 前置：§7.1 审计确认无 username IS NULL 的 sys_user 行（历史 seed 与
-- import-iximei.ts 都会保证 username 有值, 当前生产应已无 null）。
--
-- 守卫：
--   * 若仍存在 NULL 行，MODIFY 会被 MySQL 严格模式拒绝
--   * INFORMATION_SCHEMA 检查列是否已经是 NOT NULL, 避免重复跑报错

SET @col_nullable = (
  SELECT IS_NULLABLE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_user'
    AND COLUMN_NAME = 'username'
);
SET @null_count = (
  SELECT COUNT(*) FROM sys_user WHERE username IS NULL
);
SET @stmt = IF(@col_nullable IS NULL,
  'SELECT ''sys_user.username column not found'' AS error',
  IF(@col_nullable = 'NO',
    'SELECT ''sys_user.username already NOT NULL'' AS note',
    IF(@null_count > 0,
      CONCAT('SELECT ''sys_user has ', @null_count, ' rows with NULL username, fix manually before this migration'' AS error'),
      'ALTER TABLE `sys_user` MODIFY COLUMN `username` varchar(50) NOT NULL'
    )
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;