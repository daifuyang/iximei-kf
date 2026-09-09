-- 医院分类字段：'oral' | 'plastic' | 'both' | null
-- null 表示未分类（旧数据未回填成功的）。
-- 长度 20 留给未来扩展（如 'both'、'oral_both' 等）。

ALTER TABLE `crm_hospital` ADD `category` varchar(20);--> statement-breakpoint

-- 历史数据回填：根据派单客户的 plastic 字段推断医院分类。
-- 规则：
   -- 1) 该医院的任一派单客户 plastic 含「种植牙」→ 口腔医院（oral）
   -- 2) 否则该医院存在任意未软删除派单 → 整形医院（plastic）
   -- 3) 否则保持 null
-- 注意：仅对 deleted_at IS NULL 的医院与派单做判断；客户 deleted_at 也需 IS NULL。

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
  );--> statement-breakpoint

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