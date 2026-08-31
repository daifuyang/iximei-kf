# iximei-kf 案例演示数据（脱敏，本地专用）

## 用途
CRM 模块对外演示 / 案例展示时的脱敏数据。**仅操作本地 docker mysql `appdb`，不触碰线上**。

## 数据构成

| 实体 | 原 demo (手编) | 扩展 demo (faker 生成) | 总计 |
| --- | --- | --- | --- |
| sys_user 演示账号 | 5 (admin + kefu + hospital) | 8 (kefu.demo01..08) | 14（含 admin=1） |
| crm_hospital 演示医院 | 3 | 7 | 10 |
| crm_customer 演示客户 | 6 | 200 | 206 |
| crm_dispatch 演示派单 | 6 | 488 | 494 |
| crm_dispatch_reply 派单回复 | 3 | 552 | 555 |
| crm_dispatch_follow_log 派单跟进日志 | 2 | 72 | 74 |
| crm_member_customer 演示会员 | 4 | 50 | 54 |
| crm_follow_up_record 跟进记录 | 3 | 98 | 101 |

## ID 段隔离（幂等关键）

| 实体 | 演示数据 ID 段 | 说明 |
| --- | --- | --- |
| sys_user | [10, 18) | kefu.demo01..08 |
| crm_hospital | [10, 20) | 示例医美机构（脱敏品牌） |
| crm_customer | [200, 400) | KH-DEMO00001..00200 |
| crm_dispatch | [500, 1100) | 一个客户 2-3 条派单 |
| crm_member_customer | [200, 260) | HY-DEMO00001..00050 |
| crm_follow_up_record | 无固定段 | 用 member_id 段过滤 |

每次重跑**先 DELETE 演示行再 INSERT 固定 id 段**，可无限重跑不冲突。

## 行业覆盖（脱敏仿真）

- **医美**：双眼皮修复、鼻综合、脂肪填充、下颌角、假体隆胸、面部提升、吸脂
- **皮肤美容**：光子嫩肤、水光针、皮秒、热玛吉、射频、果酸
- **微整注射**：玻尿酸、肉毒素、童颜针、少女针、胶原蛋白
- **口腔**：种植牙、隐形正畸、全瓷冠、冷光美白、瓷贴面
- **毛发**：发际线、眉毛、疤痕植发
- **中医养生**：艾灸、推拿、埋线

## 真实性细节

- **姓名**：faker `zh_CN` locale 随机，姓 + 「女士/先生」
- **手机号**：13x/15x/17x/18x + 9 位随机（无主号段）
- **创建时间**：60 天窗口内随机，跨早中晚时段
- **派单状态分布**（权重）：待回复 30% / 已联系 20% / 已成交 18% / 已到院 15% / 未成交 12% / 重单 5%
- **会员阶段漏斗**：new 偏多（35%） → intending/negotiating/won 各 ~22%

## 使用方法

### 一键完整跑（原 + 扩展）
```bash
# 1. 先跑手编原版（3 院 + 6 客户 + 6 派单 + 4 会员 + 3 跟进）
docker exec -i mysql mysql -uiximei_crm_app -p'iximei密码' --default-character-set=utf8mb4 appdb < scripts/demo-seed.sql

# 2. 跑扩展版（7 院 + 200 客户 + 488 派单 + 50 会员 + ~700 回复/跟进/日志）
docker exec -i mysql mysql -uiximei_crm_app -p'iximei密码' --default-character-set=utf8mb4 appdb < scripts/demo-seed-extended.sql
```

> 密码见 `apps/yishan-api/.env` 的 `DATABASE_PASSWORD`。

### 修改扩展数据规模
1. 编辑 `scripts/demo-seed-generate.mjs` 顶部的 `HOSPITAL_COUNT` / `CUSTOMER_COUNT` / `DISPATCH_COUNT` / `MEMBER_COUNT` 常量
2. 重新生成：
   ```bash
   node scripts/demo-seed-generate.mjs
   ```
3. 重跑 SQL：
   ```bash
   docker exec -i mysql mysql -uiximei_crm_app -p'...' appdb < scripts/demo-seed-extended.sql
   ```

### 清理扩展数据（保留原版）
```bash
docker exec -i mysql mysql -uiximei_crm_app -p'...' appdb <<'EOF'
DELETE FROM crm_dispatch_follow_log WHERE dispatch_id >= 500 AND dispatch_id < 1100;
DELETE FROM crm_dispatch_reply WHERE dispatch_id >= 500 AND dispatch_id < 1100;
DELETE FROM crm_dispatch WHERE id >= 500 AND id < 1100;
DELETE FROM crm_follow_up_record WHERE member_id >= 200 AND member_id < 260;
DELETE FROM crm_member_customer WHERE id >= 200 AND id < 260;
DELETE FROM crm_customer WHERE id >= 200 AND id < 400;
DELETE FROM crm_hospital WHERE id >= 10 AND id < 20;
DELETE FROM sys_user WHERE id >= 10 AND id < 18;
EOF
```

## 已知约束

- **faker seed = 20260825**：固定种子保证每次生成结果一致（不可"再随机一次"）
- **province_id/city_id/district_id**：本地 sys_region 表为空，这三列存 NULL，CRM 前端地区选择器会显示空，但列表展示不影响
- **不创建演示登录密码**：kefu.demo01..08 的 `password_hash` 为空字符串，沿用现有 demo 账号风格（手编 demo 账号也是空 hash）；如需登录，自己补 bcrypt

## 文件清单

| 文件 | 角色 |
| --- | --- |
| `scripts/demo-seed.sql` | 手编原版（3 院 + 6 客户 + 6 派单 + 4 会员 + 3 跟进），保留作为标杆样本 |
| `scripts/demo-seed-extended.sql` | 生成器产出的扩展段（自动生成，请勿手编） |
| `scripts/demo-seed-generate.mjs` | faker 生成器（无状态，纯函数式，幂等） |
| `scripts/demo-seed.README.md` | 本文档 |