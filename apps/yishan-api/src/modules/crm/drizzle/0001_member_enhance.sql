-- Migration: 0001_member_enhance
-- Enhance crm_member_customer with customer linking, stage, intention fields, etc.
-- Create support tables for follow-up records, tags, and assignment history.

-- Step 1: Add new columns to crm_member_customer
ALTER TABLE `crm_member_customer`
  ADD COLUMN `customer_id` int NULL AFTER `number_id`,
  ADD COLUMN `wechat` varchar(50) NULL AFTER `mobile`,
  ADD COLUMN `qq` varchar(20) NULL AFTER `wechat`,
  ADD COLUMN `province_id` int NULL AFTER `address`,
  ADD COLUMN `city_id` int NULL AFTER `province_id`,
  ADD COLUMN `district_id` int NULL AFTER `city_id`,
  ADD COLUMN `source` varchar(20) NOT NULL DEFAULT 'from_customer' AFTER `district_id`,
  ADD COLUMN `business_category` varchar(50) NULL AFTER `source`,
  ADD COLUMN `intention_project` varchar(255) NULL AFTER `business_category`,
  ADD COLUMN `member_stage` varchar(30) NOT NULL DEFAULT 'new' AFTER `intention_project`,
  ADD COLUMN `intention_level` varchar(20) NOT NULL DEFAULT 'unset' AFTER `member_stage`,
  ADD COLUMN `budget_range` varchar(50) NULL AFTER `intention_level`,
  ADD COLUMN `expected_date` date NULL AFTER `budget_range`,
  ADD COLUMN `preferred_hospital_id` int NULL AFTER `expected_date`,
  ADD COLUMN `member_status` varchar(20) NOT NULL DEFAULT 'active' AFTER `preferred_hospital_id`,
  ADD COLUMN `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `member_status`,
  ADD COLUMN `invalid_at` datetime NULL AFTER `joined_at`,
  ADD COLUMN `invalid_by` int NULL AFTER `invalid_at`,
  ADD COLUMN `previous_stage` varchar(30) NULL AFTER `invalid_by`,
  ADD COLUMN `last_follow_up_at` datetime NULL AFTER `previous_stage`,
  ADD COLUMN `next_follow_up_at` datetime NULL AFTER `last_follow_up_at`,
  ADD COLUMN `remark` text NULL AFTER `next_follow_up_at`;

-- Step 2: Add unique index on customer_id (1:0..1 relationship)
ALTER TABLE `crm_member_customer`
  ADD UNIQUE INDEX `uniq_crm_member_customer_id` (`customer_id`),
  ADD INDEX `idx_crm_member_stage` (`member_stage`),
  ADD INDEX `idx_crm_member_status` (`member_status`);

-- Step 3: Create member tag table
CREATE TABLE `crm_member_tag` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `color` varchar(20) NULL,
  `status` int NOT NULL DEFAULT 1,
  `creator_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_crm_member_tag_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 4: Create member-tag relation table
CREATE TABLE `crm_member_tag_relation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `tag_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_crm_member_tag_rel` (`member_id`, `tag_id`),
  KEY `idx_crm_member_tag_rel_member` (`member_id`),
  KEY `idx_crm_member_tag_rel_tag` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 5: Create follow-up record table
CREATE TABLE `crm_follow_up_record` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `operator_user_id` int NOT NULL,
  `follow_up_method` varchar(20) NULL,
  `content` text NOT NULL,
  `result` varchar(30) NULL,
  `stage_after` varchar(30) NULL,
  `intention_level_after` varchar(20) NULL,
  `next_follow_up_at` datetime NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_crm_follow_up_member` (`member_id`),
  KEY `idx_crm_follow_up_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 6: Create assignment history table
CREATE TABLE `crm_member_assignment_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `from_user_id` int NULL,
  `to_user_id` int NOT NULL,
  `operator_user_id` int NOT NULL,
  `reason` varchar(255) NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_crm_member_assign_member` (`member_id`),
  KEY `idx_crm_member_assign_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
