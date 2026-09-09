/**
 * 默认角色的后端功能/API 权限。
 *
 * 角色菜单与角色权限是两套独立关联：前者只控制导航可见性，后者才决定
 * requirePermission() 是否放行。权限码始终来自 Core 目录或插件 manifest，
 * 种子不创建自由配置的权限定义。
 *
 * 按钮权限矩阵（fork 业务定版）:
 * | 角色 | 医院 | 客户 | 派单 | 会员 | system 下拉 |
 * | --- | --- | --- | --- | --- | --- |
 * | super_admin | ✅ CRUD | ✅ CRUD+dispatch | ✅ 全 | ✅ CRUD+remark | ✅ |
 * | admin       | ❌ | ❌ | ❌ | ❌ | ❌ |
 * | hospital_account | ❌ | ❌ | ✅ 看+回 | ❌ | region |
 * | customer_service | ❌ | ✅ CRUD+dispatch | ✅ 全 | ✅ CRUD+remark | user+region |
 *
 * 数据范围由 `sys_role.data_scope` 字段决定(本文件不再硬编码)：
 * - 1 ALL：看全部 (依赖 super_admin bypass 实际不读此字段)
 * - 4 SELF：仅 owner=自己
 * - 5 CUSTOM：模块自定义 (本 fork 暂未接 crm_hospital_account)
 *
 * 数据范围的运行时过滤在 service 层 inline 判断 `req.currentUser.roleIds` 与
 * `dataScope`，不属于本 seed 文件的关注范围。
 */

import { and, eq, isNull } from 'drizzle-orm';
import { sysRole, sysRolePermission } from '@/db/schema';
import { ROLE_IDS } from '@/constants/permission-codes.js';
import { listPermissions } from '@/core/permissions/catalog.js';
import type { SeedDb } from '../context.js';

async function findRoleById(db: SeedDb, id: number) {
  const role = await db.query.sysRole.findFirst({
    where: and(eq(sysRole.id, id), isNull(sysRole.deletedAt)),
  });
  if (!role) throw new Error(`系统角色缺失 id=${id}`);
  return role;
}

async function replaceRolePermissions(
  db: SeedDb,
  roleId: number,
  permissionCodes: readonly string[],
  creatorId: number,
) {
  await db
    .update(sysRolePermission)
    .set({ deletedAt: new Date() })
    .where(and(eq(sysRolePermission.roleId, roleId), isNull(sysRolePermission.deletedAt)));

  const uniqueCodes = [...new Set(permissionCodes)];
  if (uniqueCodes.length === 0) return;
  await db
    .insert(sysRolePermission)
    .values(uniqueCodes.map((permissionCode) => ({ roleId, permissionCode, creatorId })))
    .onDuplicateKeyUpdate({ set: { deletedAt: null, creatorId } });
}

/**
 * 医院账号(hospital_account)不能持有的派单派生 perm 黑名单。
 *
 * 设计要点：
 * - `crm:dispatches:` 前缀匹配 + 黑名单：未来新增派生 perm 会自动跟随,
 *   但 :update / :delete / :view-mobile-logs / :view-hospital-log 显式拒绝。
 *   这些是 admin / super_admin 专用 —— 编辑 / 删除派单 / 查看审计日志。
 */
export const HOSPITAL_ACCOUNT_DISPATCH_DENY: ReadonlySet<string> = new Set([
  'crm:dispatches:update',           // 不能编辑派单内容
  'crm:dispatches:delete',           // 不能删派单
  'crm:dispatches:view-mobile-logs', // 审计日志只给 super_admin
  'crm:dispatches:view-hospital-log', // 医院查看日志只给 super_admin / admin
])

/**
 * 计算医院账号(hospital_account)应该持有的权限码集合（纯函数，可直接单元测试）。
 *
 * - `crm:dispatches:` 前缀匹配 + 黑名单：未来新增派生 perm 会自动跟随,
 *   但 :update / :delete / :view-mobile-logs / :view-hospital-log 显式拒绝。
 * - `crm:hospital-dashboard:` 前缀全授予：当前仅 :view,语义上就是给医院账号看本院看板。
 * - `crm:hospitals:` **显式白名单**（plan §5.3.3）:不自动跟随新增的 :rename / :create / :delete。
 *   持有 :update 是为了让医院账号能改自己医院资料(地址/经营性质等)，
 *   但**不持有** crm:hospitals:manage-account —— 账号管理(启停/重置密码/改账号邮箱手机号)
 *   是 admin 级操作,医院账号不应拥有。
 * - region 一族 4 个 perm code 中,医院账号业务只需 tree(级联树)+ path(回填路径);
 *   list/read 是 admin 端只读管理页用的,不给医院账号。
 *
 * 历史漏配：2026-09 用户反馈 hospital_account 登录后进 /crm/dispatches 报"权限不足"。
 * 根因是 seed 里 hospitalAccountCodes 用**显式白名单**列了 5 条 crm:dispatches 派生 perm,
 * 漏配了 crm:dispatches:log —— 前端"派单跟进"按钮触发该 perm 的接口 → 403。
 * 修复方案：seed 改为 `crm:dispatches:` 前缀匹配 + 黑名单,未来新增派生 perm 会自动跟随,
 * 但 :update / :delete / :view-mobile-logs / :view-hospital-log 这些 admin/super 专用权限
 * 由黑名单显式拒绝。
 */
export function computeHospitalAccountCodes(allCodes: readonly string[]): string[] {
  return allCodes.filter((code) =>
    (code.startsWith('crm:dispatches:') && !HOSPITAL_ACCOUNT_DISPATCH_DENY.has(code)) ||
    code.startsWith('crm:hospital-dashboard:') ||
    code === 'crm:hospitals:list' ||
    code === 'crm:hospitals:update' ||
    code === 'region:tree' ||
    code === 'region:path',
  )
}

export async function bindRolePermissionsByDefault(db: SeedDb, adminUserId: number) {
  const [superAdmin, admin, hospitalAccount, customerService] = await Promise.all([
    findRoleById(db, ROLE_IDS.SUPER_ADMIN),
    findRoleById(db, ROLE_IDS.ADMIN),
    findRoleById(db, ROLE_IDS.HOSPITAL_ACCOUNT),
    findRoleById(db, ROLE_IDS.CUSTOMER_SERVICE),
  ]);
  const allCodes = listPermissions().map((item) => item.code);

  // 超级管理员: 全量 crm + system
  const superAdminCodes = allCodes

  // 普通管理员（fork 业务不配 CRM 权限）: 仅留登录入口，rbac preHandler 拒绝一切 crm 接口。
  // 菜单树和启用字典映射属于“已登录即可读取”的启动基建，已由 route registrar 统一处理，
  // 不应作为每个角色都要配置的业务权限。
  const adminCodes = allCodes.filter((code) => code === 'auth:login')

  // 医院账号：医院档案查看+编辑 + 派单'看+回+跟' + 医院看板 + 区域下拉。
  // 派生 perm 计算走 computeHospitalAccountCodes（纯函数，单元测试覆盖）。
  const hospitalAccountCodes = computeHospitalAccountCodes(allCodes)

  // 客服（商务）：客户 CRUD+派单 + 派单管理 + 会员 CRUD + 区域/用户下拉 + 自己管 API Token。
  // 注意:不持有 crm:hospitals:* —— 医院档案是商务端的资料.
  // region 一族同上,只授 tree + path;list/read 不给(避免泄露 admin 端管理界面入口)。
  const customerServiceCodes = allCodes.filter((code) =>
    [
      'crm:customers:list', 'crm:customers:create', 'crm:customers:update', 'crm:customers:dispatch',
      'crm:hospitals:options',
      'crm:dispatches:list', 'crm:dispatches:reply',
    ].includes(code) ||
    code === 'system:user:list' ||
    code === 'region:tree' ||
    code === 'region:path',
  )

  await Promise.all([
    replaceRolePermissions(db, superAdmin.id, superAdminCodes, adminUserId),
    replaceRolePermissions(db, admin.id, adminCodes, adminUserId),
    replaceRolePermissions(db, hospitalAccount.id, hospitalAccountCodes, adminUserId),
    replaceRolePermissions(db, customerService.id, customerServiceCodes, adminUserId),
  ]);
}
