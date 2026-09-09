-- 待执行的 DB 迁移：crm_hospital 新增 category 字段（医院分布看板依赖）
-- 触发条件：运维准备好让 super_admin dashboard 看到「医院分布看板」真实数据时
-- 触发方式：
--   1. cd apps/yishan-api/src/modules/crm
--   2. npx drizzle-kit generate --config=./drizzle.config.ts
--      （这一步会在 drizzle.ts 加 category 字段时自动生成新 0003_*.sql）
--   3. 把本文件中的 ALTER TABLE 和 UPDATE 语句合并到生成的 .sql 中
--   4. 提交 .sql + meta/_journal.json + meta/<new>_snapshot.json
--   5. 同步在 apps/yishan-api/src/modules/crm/db/schema.ts 把
--      crmHospital 表加回 `category: varchar('category', { length: 20 }),`
--   6. 把 apps/yishan-api/src/modules/crm/repositories/dashboard.repository.ts
--      里的 `getHospitalDistributionByCity` 降级 try/catch 删掉（不再需要）
--   7. pnpm --filter yishan-api db:migrate + 重启 API
--
-- 历史：本会话 2026-09-08 已写好本 SQL 的 ALTER TABLE + UPDATE 部分，
-- 但因为加 schema 字段会导致所有 crm_hospital 查询 500（Unknown column），
-- 故本次 commit 只把 raw SQL 降级放进 repository，schema 字段延后补。
-- 完整流程见 TODO-hospital-admin-online-bug-2026-09-09.md「修复方案」。

ALTER TABLE `crm_hospital` ADD `category` varchar(20);

UPDATE `crm_hospital` h
SET `category` = 'oral'
WHERE `h`.`category` IS NULL
  AND EXISTS (
    SELECT 1
    FROM `crm_dispatch` d
    JOIN `crm_customer` c ON c.id = d.customer_id
    WHERE d.hospital_id = h.id
      AND d.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND c.plastic LIKE '%种植牙%'
  );

UPDATE `crm_hospital` h
SET `category` = 'plastic'
WHERE `h`.`category` IS NULL
  AND `h`.`deleted_at` IS NULL
  AND EXISTS (
    SELECT 1
    FROM `crm_dispatch` d
    WHERE d.hospital_id = h.id
      AND d.deleted_at IS NULL
  );
