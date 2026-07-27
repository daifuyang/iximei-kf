-- Migration: 0002_hospital_single_account
-- 一院一账号 breaking change 的 schema 改动。
--
-- 本次仅做 DB 收缩（hospital_name 100→50），不写 NOT NULL / DROP TABLE，
-- 留给 §7.3.6 的合同迁移在数据清理完成后单独执行。
--
-- 前置（必须完成后再执行本脚本）：
--   1. §7.1.E 审计：SELECT id, hospital_name, CHAR_LENGTH(hospital_name)
--      FROM crm_hospital WHERE deleted_at IS NULL AND CHAR_LENGTH(hospital_name) > 50;
--   2. 人工规范所有超长名称（不允许截断后作为用户名）
--   3. 业务签字确认后，再跑本迁移
--
-- 运行：mysql -h... -u... -p... iximei-crm < <(awk '!/statement-breakpoint/' \
--          apps/yishan-api/src/modules/crm/drizzle/0002_hospital_single_account.sql)
-- 与 apps/yishan-api/drizzle/0002 一致,**不**注册进 _journal.json；
-- 由运维手跑一次，下次 db:generate 不会重新生成（schema 已是 50 字）。
--
-- 守卫：
--   * 若仍存在 hospital_name 长度 > 50 的行，MODIFY 会被 MySQL 严格模式拒绝
--   * INFORMATION_SCHEMA 检查列定义，避免重复跑报错

SET @col_len = (
  SELECT CHARACTER_MAXIMUM_LENGTH
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'crm_hospital'
    AND COLUMN_NAME = 'hospital_name'
);
SET @stmt = IF(@col_len IS NULL,
  'SELECT ''crm_hospital.hospital_name column not found'' AS error',
  IF(@col_len = 50,
    'SELECT ''crm_hospital.hospital_name already varchar(50)'' AS note',
    IF(@col_len <> 100,
      CONCAT('SELECT ''unexpected hospital_name length: ', @col_len, ', manual review required'' AS error'),
      -- 再次校验：仍存在 > 50 字的行则中止
      IF((SELECT COUNT(*) FROM crm_hospital
          WHERE deleted_at IS NULL
            AND CHAR_LENGTH(hospital_name) > 50) > 0,
        'SELECT ''still has rows with hospital_name > 50 chars, run §7.1.E audit and fix before this migration'' AS error',
        'ALTER TABLE `crm_hospital` MODIFY COLUMN `hospital_name` varchar(50) NOT NULL'
      )
    )
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;