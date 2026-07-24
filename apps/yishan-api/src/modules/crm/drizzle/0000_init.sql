-- Iximei CRM plugin tables. All database objects use the immutable iximei_crm namespace.

CREATE TABLE `crm_hospital` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `account_user_id` INTEGER NULL,
  `hospital_name` VARCHAR(100) NOT NULL, `province_id` INTEGER NULL, `city_id` INTEGER NULL, `district_id` INTEGER NULL,
  `hospital_address` VARCHAR(255) NULL, `hospital_phone` VARCHAR(50) NULL, `hospital_selling` VARCHAR(255) NULL, `hospital_website` VARCHAR(255) NULL,
  `hospital_nature` TINYINT NOT NULL DEFAULT -1, `doctor_name` VARCHAR(50) NULL, `doctor_phone` VARCHAR(50) NULL, `doctor_qq` VARCHAR(50) NULL,
  `reception_name` VARCHAR(50) NULL, `reception_phone` VARCHAR(50) NULL, `reception_qq` VARCHAR(50) NULL,
  `bus_station` VARCHAR(100) NULL, `bus_address` VARCHAR(255) NULL, `subway_station` VARCHAR(100) NULL, `subway_address` VARCHAR(255) NULL,
  `taxi_fare` VARCHAR(50) NULL, `vip_discount` VARCHAR(255) NULL, `return_point` VARCHAR(50) NULL, `hospital_introduction` TEXT NULL,
  `contract_photos` JSON NULL, `wechat_openid` VARCHAR(64) NULL, `status` TINYINT NOT NULL DEFAULT 1,
  `creator_id` INTEGER NOT NULL, `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), `updater_id` INTEGER NOT NULL,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), `deleted_at` DATETIME(0) NULL, `version` INTEGER NOT NULL DEFAULT 1,
  UNIQUE INDEX `uniq_crm_hospital_account_user` (`account_user_id`), UNIQUE INDEX `uniq_crm_hospital_name` (`hospital_name`),
  INDEX `idx_crm_hospital_region` (`province_id`, `city_id`, `district_id`), INDEX `idx_crm_hospital_status` (`status`), INDEX `idx_crm_hospital_deleted_at` (`deleted_at`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `crm_customer_status` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `name` VARCHAR(50) NOT NULL, `sort_order` INTEGER NOT NULL DEFAULT 0, `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  UNIQUE INDEX `uniq_crm_customer_status_name` (`name`), INDEX `idx_crm_customer_status` (`status`, `sort_order`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `crm_customer` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `number_id` VARCHAR(20) NOT NULL, `name` VARCHAR(50) NOT NULL, `gender` TINYINT NOT NULL DEFAULT 0, `birthday` DATE NULL,
  `telphone` VARCHAR(20) NULL, `mobile` VARCHAR(20) NULL, `qq` VARCHAR(20) NULL, `wechat` VARCHAR(50) NULL,
  `province_id` INTEGER NULL, `city_id` INTEGER NULL, `district_id` INTEGER NULL, `address` VARCHAR(255) NULL, `plastic` VARCHAR(255) NULL,
  `status_id` INTEGER NOT NULL, `remark` TEXT NULL, `owner_user_id` INTEGER NOT NULL, `creator_id` INTEGER NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), `updater_id` INTEGER NOT NULL, `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `deleted_at` DATETIME(0) NULL, `version` INTEGER NOT NULL DEFAULT 1,
  UNIQUE INDEX `uniq_crm_customer_number_id` (`number_id`), INDEX `idx_crm_customer_owner` (`owner_user_id`), INDEX `idx_crm_customer_status` (`status_id`), INDEX `idx_crm_customer_mobile` (`mobile`), INDEX `idx_crm_customer_created` (`created_at`), INDEX `idx_crm_customer_deleted_at` (`deleted_at`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `crm_customer_remark` (`id` INTEGER NOT NULL AUTO_INCREMENT, `customer_id` INTEGER NOT NULL, `user_id` INTEGER NOT NULL, `content` TEXT NOT NULL, `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), INDEX `idx_crm_customer_remark_customer` (`customer_id`), INDEX `idx_crm_customer_remark_user` (`user_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `crm_customer_browse` (`id` INTEGER NOT NULL AUTO_INCREMENT, `customer_id` INTEGER NOT NULL, `user_id` INTEGER NOT NULL, `action` VARCHAR(20) NOT NULL DEFAULT 'view', `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), INDEX `idx_crm_customer_browse_customer` (`customer_id`), INDEX `idx_crm_customer_browse_user` (`user_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `crm_dispatch_status` (`id` INTEGER NOT NULL AUTO_INCREMENT, `name` VARCHAR(50) NOT NULL, `sort_order` INTEGER NOT NULL DEFAULT 0, `status` TINYINT NOT NULL DEFAULT 1, `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), UNIQUE INDEX `uniq_crm_dispatch_status_name` (`name`), INDEX `idx_crm_dispatch_status` (`status`, `sort_order`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `crm_dispatch` (`id` INTEGER NOT NULL AUTO_INCREMENT, `customer_id` INTEGER NOT NULL, `hospital_id` INTEGER NOT NULL, `status_id` INTEGER NOT NULL, `image` VARCHAR(500) NULL, `receive_qq` VARCHAR(50) NULL, `receive_wechat` VARCHAR(50) NULL, `finished_at` DATETIME(0) NULL, `creator_id` INTEGER NOT NULL, `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), `updater_id` INTEGER NOT NULL, `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), `deleted_at` DATETIME(0) NULL, `version` INTEGER NOT NULL DEFAULT 1, INDEX `idx_crm_dispatch_customer` (`customer_id`), INDEX `idx_crm_dispatch_hospital` (`hospital_id`), INDEX `idx_crm_dispatch_status` (`status_id`), INDEX `idx_crm_dispatch_created` (`created_at`), INDEX `idx_crm_dispatch_deleted_at` (`deleted_at`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `crm_dispatch_reply` (`id` INTEGER NOT NULL AUTO_INCREMENT, `dispatch_id` INTEGER NOT NULL, `user_id` INTEGER NOT NULL, `content` TEXT NOT NULL, `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), INDEX `idx_crm_dispatch_reply_dispatch` (`dispatch_id`), INDEX `idx_crm_dispatch_reply_user` (`user_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `crm_dispatch_follow_log` (`id` INTEGER NOT NULL AUTO_INCREMENT, `dispatch_id` INTEGER NOT NULL, `user_id` INTEGER NOT NULL, `content` TEXT NOT NULL, `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), INDEX `idx_crm_dispatch_log_dispatch` (`dispatch_id`), INDEX `idx_crm_dispatch_log_user` (`user_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `crm_member_customer` (`id` INTEGER NOT NULL AUTO_INCREMENT, `number_id` VARCHAR(20) NOT NULL, `name` VARCHAR(50) NOT NULL, `gender` TINYINT NOT NULL DEFAULT 0, `birthday` DATE NULL, `address` VARCHAR(255) NULL, `mobile` VARCHAR(20) NULL, `project` VARCHAR(255) NULL, `owner_user_id` INTEGER NOT NULL, `creator_id` INTEGER NOT NULL, `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), `updater_id` INTEGER NOT NULL, `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), `deleted_at` DATETIME(0) NULL, `version` INTEGER NOT NULL DEFAULT 1, UNIQUE INDEX `uniq_crm_member_number_id` (`number_id`), INDEX `idx_crm_member_owner` (`owner_user_id`), INDEX `idx_crm_member_mobile` (`mobile`), INDEX `idx_crm_member_created` (`created_at`), INDEX `idx_crm_member_deleted_at` (`deleted_at`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `crm_member_remark` (`id` INTEGER NOT NULL AUTO_INCREMENT, `member_id` INTEGER NOT NULL, `user_id` INTEGER NOT NULL, `content` TEXT NOT NULL, `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), INDEX `idx_crm_member_remark_member` (`member_id`), INDEX `idx_crm_member_remark_user` (`user_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `crm_member_browse` (`id` INTEGER NOT NULL AUTO_INCREMENT, `member_id` INTEGER NOT NULL, `user_id` INTEGER NOT NULL, `action` VARCHAR(20) NOT NULL DEFAULT 'view', `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), INDEX `idx_crm_member_browse_member` (`member_id`), INDEX `idx_crm_member_browse_user` (`user_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `crm_hospital_account` (`id` INTEGER NOT NULL AUTO_INCREMENT, `hospital_id` INTEGER NOT NULL, `user_id` INTEGER NOT NULL, `role` VARCHAR(20) NOT NULL DEFAULT 'member', `status` TINYINT NOT NULL DEFAULT 1, `remark` VARCHAR(255) NULL, `creator_id` INTEGER NOT NULL, `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), `updater_id` INTEGER NOT NULL, `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0), `deleted_at` DATETIME(0) NULL, UNIQUE INDEX `uniq_crm_hospital_account` (`hospital_id`, `user_id`), INDEX `idx_crm_hospital_account_hospital` (`hospital_id`), INDEX `idx_crm_hospital_account_user` (`user_id`), INDEX `idx_crm_hospital_account_status` (`status`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
INSERT INTO `crm_customer_status` (`id`,`name`,`sort_order`,`status`) VALUES (1,'资料录入',1,1),(2,'待跟进',2,1),(3,'重单',3,1),(4,'已手术',4,1),(5,'无效用户',5,1) ON DUPLICATE KEY UPDATE `name`=VALUES(`name`),`sort_order`=VALUES(`sort_order`),`status`=VALUES(`status`);
--> statement-breakpoint
INSERT INTO `crm_dispatch_status` (`id`,`name`,`sort_order`,`status`) VALUES (1,'待回复',1,1),(2,'已联系',2,1),(3,'已到院',3,1),(4,'已成交',4,1),(5,'未成交',5,1),(6,'重单',6,1) ON DUPLICATE KEY UPDATE `name`=VALUES(`name`),`sort_order`=VALUES(`sort_order`),`status`=VALUES(`status`);
