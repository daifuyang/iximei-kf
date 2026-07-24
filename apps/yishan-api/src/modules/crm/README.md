# CRM 模块

CRM 提供医院、客户、派单和会员管理，路由挂载在 `/api/crm/v1`。

## 表名迁移

| 旧表名 | 新表名 |
| --- | --- |
| iximei_crm_hospital | crm_hospital |
| iximei_crm_customer_status | crm_customer_status |
| iximei_crm_customer | crm_customer |
| iximei_crm_customer_remark | crm_customer_remark |
| iximei_crm_customer_browse | crm_customer_browse |
| iximei_crm_dispatch_status | crm_dispatch_status |
| iximei_crm_dispatch | crm_dispatch |
| iximei_crm_dispatch_reply | crm_dispatch_reply |
| iximei_crm_dispatch_follow_log | crm_dispatch_follow_log |
| iximei_crm_member_customer | crm_member_customer |
| iximei_crm_member_remark | crm_member_remark |
| iximei_crm_member_browse | crm_member_browse |
| iximei_crm_hospital_account | crm_hospital_account |

迁移脚本只用于人工执行，模块启动不会自动修改数据库。
