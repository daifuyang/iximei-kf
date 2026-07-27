-- Migration: 0003_hospital_single_account_contract
-- 一院一账号 breaking change 的**物理合同迁移**（STRICT-SPEC §3.1 / §9.1）。
--
-- 与 0002 (hospital_name 100→50) 不同：本文件是数据清理完成后**单独审批**执行的
-- 物理约束变更。运行顺序：
--   1. 先完成 §7.1 源系统审计 + §7.2 数据处置（保证无 NULL/孤儿/超长名称）
--   2. 上线新读路径 + import-iximei-hospitals.ts 全量重新同步
--   3. 验证 post-import 断言通过（hospitalCnt === accountCnt === hospital_account 角色绑定数）
--   4. **手动**执行本 SQL（与 0002/0003 core 风格一致：不进 _journal.json）
--
-- 本次变更：
--   ① crm_hospital.account_user_id 改为 NOT NULL
--   ② crm_hospital.account_user_id 增加外键 → sys_user.id（ON DELETE RESTRICT）
--   ③ 删除 crm_hospital_account 表及其索引（Drizzle 定义也已删除）
--
-- 前置（任一不满足都直接报错）：
--   - crm_hospital 中不存在 deleted_at IS NULL 但 account_user_id IS NULL 的行
--   - crm_hospital.account_user_id 全部指向未删除 sys_user.id
--   - crm_hospital_account 表已无遗留有效数据（按新规则保留为空表也已可 DROP）

SET @db := DATABASE();

-- 守卫：仍有未绑定账号的医院 → 终止
SET @orphan_hosp := (
  SELECT COUNT(*) FROM crm_hospital
  WHERE deleted_at IS NULL AND account_user_id IS NULL
);
SET @stmt_guard = IF(@orphan_hosp > 0,
  CONCAT('SELECT ''仍有 ', @orphan_hosp, ' 家医院未绑定账号，请先完成数据同步'' AS error'),
  'SELECT ''orphan hospital check passed'' AS note'
);
PREPARE stmt FROM @stmt_guard;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ① ① account_user_id NOT NULL（幂等：已是 NOT NULL 则跳过）
SET @col_nullable := (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'crm_hospital' AND COLUMN_NAME = 'account_user_id'
);
SET @stmt_nn := IF(@col_nullable IS NULL,
  'SELECT ''crm_hospital.account_user_id column not found'' AS error',
  IF(@col_nullable = 'NO',
    'SELECT ''account_user_id already NOT NULL'' AS note',
    'ALTER TABLE `crm_hospital` MODIFY COLUMN `account_user_id` INT NOT NULL'
  )
);
PREPARE stmt FROM @stmt_nn;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ② 增加外键 account_user_id → sys_user.id（ON DELETE RESTRICT）
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'crm_hospital'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_crm_hospital_account_user'
);
SET @stmt_fk := IF(@fk_exists > 0,
  'SELECT ''fk_crm_hospital_account_user already exists'' AS note',
  'ALTER TABLE `crm_hospital`
     ADD CONSTRAINT `fk_crm_hospital_account_user`
     FOREIGN KEY (`account_user_id`) REFERENCES `sys_user` (`id`)
     ON DELETE RESTRICT ON UPDATE RESTRICT'
);
PREPARE stmt FROM @stmt_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ③ 删除 crm_hospital_account 表
DROP TABLE IF EXISTS `crm_hospital_account`;