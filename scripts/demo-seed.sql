-- ============================================================
-- iximei-kf 案例分享演示数据（脱敏，仅供本地截图）
-- 只操作本地 docker mysql appdb，不触碰线上。
-- 幂等：先删演示行再插入。
-- ============================================================
SET NAMES utf8mb4;

-- ---------- 状态字典（沿用库中既有字典，仅对齐含义，不重复插入） ----------
-- crm_customer_status: 1 资料录入 / 2 待跟进 / 3 重单 / 4 已手术 / 5 无效用户
-- crm_dispatch_status: 1 待回复 / 2 已联系 / 3 已到院 / 4 已成交 / 5 未成交 / 6 重单

-- ---------- 演示账号（密码统一 admin123，仅本地库；每院一个对接账号） ----------
-- sys_user: 1 admin / 2 kefu.lisi / 3 kefu.wang / 4 hospital.b / 5 hospital.a / 6 hospital.c
-- crm_hospital.account_user_id: 1→6(口腔) 2→5(人民医院) 3→4(医美门诊)
INSERT INTO sys_user (id, username, email, password_hash, password_format, real_name, nickname, gender, status, creator_id, updater_id)
VALUES
 (2, 'kefu.lisi',   'lisi@example.com',     '', 1, '李四', '李四·客服A组', 1, 1, 1, 1),
 (3, 'kefu.wang',   'wang@example.com',     '', 1, '王五', '王五·客服B组', 1, 1, 1, 1),
 (4, 'hospital.b',  'hospitalb@example.com','', 1, '示例医美门诊对接', '医院B·对接账号', 1, 1, 1, 1),
 (5, 'hospital.a',  'hospitala@example.com','', 1, '示例人民医院对接', '医院A·对接账号', 1, 1, 1, 1),
 (6, 'hospital.c',  'hospitalc@example.com','', 1, '示例口腔门诊对接', '医院C·对接账号', 1, 1, 1, 1)
ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), real_name = VALUES(real_name), status = 1, deleted_at = NULL;

-- ---------- 医院（id: 1 口腔→user6 / 2 人民医院整形科→user5 / 3 医美门诊→user4） ----------
INSERT INTO crm_hospital (id, account_user_id, hospital_name, province_id, city_id, district_id, hospital_address, hospital_phone, hospital_selling, hospital_website, hospital_nature, doctor_name, doctor_phone, doctor_qq, reception_name, reception_phone, reception_qq, bus_station, bus_address, subway_station, subway_address, taxi_fare, vip_discount, return_point, hospital_introduction, status, creator_id, updater_id)
VALUES
 (1, 6, '示例口腔门诊部', 510000, 510100, 510104, '成都市锦江区示例街 6 号', '028-86669999', '种植牙、正畸、美白', 'https://hospital-c.example.com', 2, '郑医生', '13700000001', '88880005', '前台小吴', '13700000002', '88880006', '示例街站', '锦江区示例街 6 号东门', '地铁 2 号线示例站 C 口', '步行 150 米', '约 20 元', '无', '返点按季度结算', '口腔专科门诊部，仅用于演示。', 1, 1, 1),
 (2, 5, '示例人民医院（整形美容科）', 440000, 440100, 440106, '广东省广州市天河区示例路 88 号', '020-88886666', '眼综合、鼻综合、脂肪填充', 'https://hospital-a.example.com', 1, '周医生', '13800000001', '88880001', '前台小林', '13800000002', '88880002', '示例路站', '天河区示例路 88 号正门', '地铁 3 号线示例站 B 口', '步行 400 米', '约 35 元', 'VIP 95 折', '返点按月结算', '示范性三级医院，整形美容科为特色科室，仅用于演示。', 1, 1, 1),
 (3, 4, '示例医疗美容门诊部', 310000, 310100, 310104, '上海市徐汇区示例大道 120 号', '021-66668888', '皮肤管理、光电项目、注射微整', 'https://hospital-b.example.com', 2, '吴医生', '13900000001', '88880003', '前台小周', '13900000002', '88880004', '示例大道站', '徐汇区示例大道 120 号', '地铁 1 号线示例站 2 口', '步行 250 米', '约 28 元', 'VIP 9 折', '返点按单结算', '轻医美连锁门诊部，仅用于演示。', 1, 1, 1)
ON DUPLICATE KEY UPDATE hospital_name = VALUES(hospital_name), hospital_address = VALUES(hospital_address), account_user_id = VALUES(account_user_id), status = 1, deleted_at = NULL;

-- ---------- 客户 ----------
INSERT INTO crm_customer (id, number_id, name, gender, birthday, telphone, mobile, qq, wechat, province_id, city_id, district_id, address, plastic, status_id, remark, owner_user_id, creator_id, updater_id)
VALUES
 (10, 'KH20260801001', '张女士', 2, '1993-05-12', NULL, '13600001001', '100010001', 'zhangfuren01', 440000, 440100, 440106, '广东省广州市天河区示例路 10 号', '双眼皮修复', 2, '线上咨询双眼皮修复，预算 1.2w，关心恢复期。', 2, 2, 2),
 (11, 'KH20260801002', '陈先生', 1, '1988-11-03', NULL, '13600001002', '100010002', 'chenxiansheng', 440000, 440100, 440104, '广东省广州市越秀区示例大道 3 号', '鼻综合', 3, '已预约到院面诊，指定周医生。', 2, 2, 2),
 (12, 'KH20260802001', '刘女士', 2, '1996-02-18', NULL, '13600001003', NULL, 'liunvshi2026', 310000, 310100, 310104, '上海市徐汇区示例新村 8 幢', '光子嫩肤', 2, '皮肤偏敏感，先做皮肤检测再定方案。', 3, 3, 3),
 (13, 'KH20260802002', '黄先生', 1, '1990-07-25', NULL, '13600001004', '100010004', NULL, 510000, 510100, 510104, '成都市锦江区示例巷 12 号', '种植牙', 4, '已成交种植牙两颗，进入术后回访。', 3, 3, 3),
 (14, 'KH20260803001', '吴女士', 2, '1995-09-09', NULL, '13600001005', '100010005', 'wunvshi09', 440000, 440100, 440106, '广东省广州市天河区示例街 66 号', '脂肪填充', 1, '刚留资，尚未首次联系。', 2, 2, 2),
 (15, 'KH20260803002', '周女士', 2, '1992-12-30', NULL, '13600001006', NULL, NULL, 310000, 310100, 310104, '上海市徐汇区示例路 99 弄', '水光针', 5, '号码多次无人接听，标记无效。', 3, 3, 3)
ON DUPLICATE KEY UPDATE name = VALUES(name), mobile = VALUES(mobile), status_id = VALUES(status_id), owner_user_id = VALUES(owner_user_id), deleted_at = NULL;

DELETE FROM crm_customer WHERE id < 10 AND number_id LIKE 'CUS-TEST-%';
UPDATE crm_member_customer SET customer_id = 10 WHERE id = 1;

-- ---------- 派单 ----------
DELETE FROM crm_dispatch WHERE id BETWEEN 100 AND 130;
INSERT INTO crm_dispatch (id, customer_id, hospital_id, status_id, image, receive_qq, receive_wechat, finished_at, creator_id, updater_id, created_at, updated_at)
VALUES
 (100, 10, 2, 2, NULL, '88880001', 'hospitala-kefu', NULL, 2, 2, '2026-08-20 09:30:00', '2026-08-20 10:00:00'),
 (101, 11, 2, 3, NULL, '88880001', 'hospitala-kefu', NULL, 2, 2, '2026-08-20 11:00:00', '2026-08-21 15:00:00'),
 (102, 12, 3, 1, NULL, NULL, NULL, NULL, 3, 3, '2026-08-21 16:20:00', '2026-08-21 16:20:00'),
 (103, 13, 1, 4, NULL, '88880005', 'hospitalc-kefu', '2026-08-18 17:00:00', 3, 3, '2026-08-16 10:00:00', '2026-08-18 17:00:00'),
 (104, 14, 2, 1, NULL, NULL, NULL, NULL, 2, 2, '2026-08-22 08:45:00', '2026-08-22 08:45:00'),
 (105, 12, 3, 5, NULL, '88880003', NULL, NULL, 3, 3, '2026-08-15 14:00:00', '2026-08-15 18:00:00');

INSERT INTO crm_dispatch_reply (dispatch_id, user_id, content, created_at) VALUES
 (101, 2, '客户已到院，面诊周医生，方案鼻综合 + 耳软骨，报价 2.6w。', '2026-08-21 15:05:00'),
 (101, 4, '已确认到院，按约定登记返点。', '2026-08-21 15:20:00'),
 (103, 3, '种植两颗已完成，术后医嘱已发客户微信。', '2026-08-18 17:05:00')
ON DUPLICATE KEY UPDATE content = VALUES(content);

INSERT INTO crm_dispatch_follow_log (dispatch_id, user_id, content, created_at) VALUES
 (101, 2, '术后第 3 天电话回访，恢复正常。', '2026-08-24 10:00:00'),
 (103, 3, '术后 1 周回访，无异常，预约拆线。', '2026-08-25 09:30:00')
ON DUPLICATE KEY UPDATE content = VALUES(content);

-- ---------- 会员 ----------
DELETE FROM crm_member_customer WHERE id BETWEEN 10 AND 30;
INSERT INTO crm_member_customer (id, number_id, customer_id, name, gender, birthday, mobile, wechat, qq, address, province_id, city_id, district_id, source, business_category, intention_project, member_stage, intention_level, budget_range, expected_date, preferred_hospital_id, member_status, joined_at, last_follow_up_at, next_follow_up_at, owner_user_id, remark, creator_id, updater_id)
VALUES
 (10, 'HY20260001', 10, '张女士', 2, '1993-05-12', '13600001001', 'zhangfuren01', '100010001', '广东省广州市天河区示例路 10 号', 440000, 440100, 440106, 'from_customer', '医美', '双眼皮修复', 'intending', 'b', '1w-2w', '2026-09-10', 2, 'active', '2026-08-05 10:00:00', '2026-08-23 11:00:00', '2026-08-30 11:00:00', 2, '老客转介绍，对价格敏感，可推活动。', 2, 2),
 (11, 'HY20260002', NULL, '孙先生', 1, '1985-03-21', '13600001007', 'sunxiansheng', NULL, '上海市浦东新区示例路 300 号', 310000, 310100, 310115, 'referral', '口腔', '隐形正畸', 'negotiating', 'a', '3w-5w', '2026-09-25', 1, 'active', '2026-08-08 09:00:00', '2026-08-22 16:00:00', '2026-08-29 16:00:00', 3, '朋友介绍，正在比价两家门诊。', 3, 3),
 (12, 'HY20260003', 13, '黄先生', 1, '1990-07-25', '13600001004', NULL, '100010004', '成都市锦江区示例巷 12 号', 510000, 510100, 510104, 'from_customer', '口腔', '种植牙', 'won', 'a', '2w-3w', NULL, 1, 'active', '2026-08-16 10:00:00', '2026-08-18 17:30:00', '2026-09-18 10:00:00', 3, '已成交，进入术后回访周期。', 3, 3),
 (13, 'HY20260004', NULL, '钱女士', 2, '1998-06-06', '13600001008', 'qiannvshi', NULL, '广东省广州市天河区示例街 5 号', 440000, 440100, 440106, 'offline', '医美', '注射微整', 'new', 'unset', NULL, NULL, 3, 'active', '2026-08-23 14:00:00', NULL, '2026-08-25 14:00:00', 2, '线下活动留资，待首次触达。', 2, 2)
ON DUPLICATE KEY UPDATE name = VALUES(name), member_stage = VALUES(member_stage), owner_user_id = VALUES(owner_user_id), deleted_at = NULL;

DELETE FROM crm_member_customer WHERE id = 1 AND number_id LIKE 'MEM-TEST-%';

-- ---------- 跟进记录 ----------
INSERT INTO crm_follow_up_record (id, member_id, operator_user_id, content, follow_up_method, result, stage_after, intention_level_after, next_follow_up_at, created_at)
VALUES
 (1, 10, 2, '微信沟通双眼皮修复方案，发送案例图。', 'wechat', 'positive', 'intending', 'b', '2026-08-30 11:00:00', '2026-08-23 11:00:00'),
 (2, 11, 3, '电话比价沟通，强调医生资质与售后。', 'phone', 'neutral', 'negotiating', 'a', '2026-08-29 16:00:00', '2026-08-22 16:00:00'),
 (3, 12, 3, '术后回访，无异常。', 'phone', 'done', 'won', 'a', '2026-09-18 10:00:00', '2026-08-18 17:30:00')
ON DUPLICATE KEY UPDATE content = VALUES(content);

SELECT 'demo-seed-done' AS result;
