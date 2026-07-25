-- 老 iximei 用户迁移: 给 sys_user 加 password_format + password_change_recommended 两列.
--
-- 这份 SQL 与 0001_sys_module.sql 一样,**不通过 drizzle-kit 生成/迁移**, 而是手写。
-- 原因: 本仓库当前 _journal.json 没注册 0001, 直接 db:generate 会触发元数据冲突;
-- 而本文件本身也只需在生产部署时跑一次, 暂不接入 drizzle-kit metadata。
--
-- 设计:
--   password_format tinyint NOT NULL DEFAULT 1
--     0 = 老 iximei (thinkcmf 5.x) '###'+md5(md5(authcode+pw))
--     1 = 新系统 scrypt v1 ($scrypt$v=1$...)
--     历史 admin/seed 用户的 hash 已经是 scrypt v1, 默认 1 正确
--     导入脚本 import-iximei.ts 会把老 iximei 用户标记为 0
--
--   password_change_recommended tinyint NOT NULL DEFAULT 0
--     0 = 不提示用户改密; 1 = 登录后显示 banner
--     解耦自 password_format, 只有用户主动走完 changePassword 才清 0
--
-- 字段加好后:
--   ALTER TABLE ADD COLUMN NOT NULL DEFAULT <value> 在 MySQL 上自动回填历史行,
--   不需要先 UPDATE WHERE NULL 的 follow-up 步骤。
--
-- 重复跑是幂等的 (通过 INFORMATION_SCHEMA 守卫):
--   * 该列已存在 → SELECT 1 占位, 不出错
--   * 该列不存在 → ALTER ADD COLUMN
--
-- MySQL 8.0.43 实测通过 (本仓库 docker 镜像版本)。
--
-- 运行方式 (任选其一):
--
--   方式 1. 通过 mysql CLI + -e 选项 (推荐, 见 scripts/import-iximei.README.md):
--     mysql -h... -u... -p... iximei-crm < <(awk '!/statement-breakpoint/' \
--       apps/yishan-api/drizzle/0002_password_format_and_recommended.sql)
--
--   方式 2. 通过 DBeaver/Navicat 等 GUI, 把"操作步骤"一节复制粘贴执行
--
--   方式 3. 集成进项目根 scripts/db-migrate.sh (后续单独 PR)
--
-- 见 ./scripts/import-iximei.README.md §"准备迁移" 一节。

-- ============================================================
-- 操作步骤 (粘贴到 mysql CLI 多行模式或者 GUI 里执行):
-- ============================================================

SET @c1 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_user' AND COLUMN_NAME='password_format');
SET @s1 = IF(@c1 = 0,
  'ALTER TABLE `sys_user` ADD COLUMN `password_format` tinyint NOT NULL DEFAULT 1 COMMENT ''0=老 iximei ###md5; 1=新系统 scrypt v1''',
  'SELECT ''password_format already exists'' AS note');
PREPARE stmt FROM @s1;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c2 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_user' AND COLUMN_NAME='password_change_recommended');
SET @s2 = IF(@c2 = 0,
  'ALTER TABLE `sys_user` ADD COLUMN `password_change_recommended` tinyint NOT NULL DEFAULT 0 COMMENT ''登录后是否显示改密 banner;只有 changePassword 主动改密后才清 0''',
  'SELECT ''password_change_recommended already exists'' AS note');
PREPARE stmt FROM @s2;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
