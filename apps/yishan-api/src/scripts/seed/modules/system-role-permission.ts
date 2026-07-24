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
 * 数据范围的运行时过滤在 service 层 inline 判断 `req.currentUser.roleCodes` 与
 * `dataScope`，不属于本 seed 文件的关注范围。
 */

import { and, eq, isNull } from 'drizzle-orm';
import { sysRole, sysRolePermission } from '@/db/schema';
import { ROLE_CODES } from '@/constants/permission-codes.js';
import { listPermissions } from '@/core/permissions/catalog.js';
import type { SeedDb } from '../context.js';

async function findRoleByCode(db: SeedDb, code: string) {
  const role = await db.query.sysRole.findFirst({
    where: and(eq(sysRole.code, code), isNull(sysRole.deletedAt)),
  });
  if (!role) throw new Error(`系统角色缺失 code=${code}`);
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

export async function bindRolePermissionsByDefault(db: SeedDb, adminUserId: number) {
  const [superAdmin, admin, hospitalAccount, customerService] = await Promise.all([
    findRoleByCode(db, ROLE_CODES.SUPER_ADMIN),
    findRoleByCode(db, ROLE_CODES.ADMIN),
    findRoleByCode(db, ROLE_CODES.HOSPITAL_ACCOUNT),
    findRoleByCode(db, ROLE_CODES.CUSTOMER_SERVICE),
  ]);
  const allCodes = listPermissions().map((item) => item.code);

  // 超级管理员: 全量 crm + system
  const superAdminCodes = allCodes

  // 普通管理员（fork 业务不配 CRM 权限）: 仅留登录入口，rbac preHandler 拒绝一切 crm 接口
  const adminCodes = allCodes.filter((code) => code === 'auth:login')

  // 医院账号：只接派单的"看+回" + 区域下拉（医院档案属于商务/超管)
  const hospitalAccountCodes = allCodes.filter((code) =>
    code.startsWith('crm:dispatches:list') ||
    code.startsWith('crm:dispatches:update') ||
    code.startsWith('crm:dispatches:reply') ||
    code.startsWith('system:region:list'),
  )

  // 客服（商务）：客户 CRUD+派单 + 派单管理 + 会员 CRUD + 区域/用户下拉
  // 注意:不持有 crm:hospitals:* —— 医院档案是商务端的资料.
  const customerServiceCodes = allCodes.filter((code) =>
    code.startsWith('crm:customers:') ||
    code.startsWith('crm:dispatches:') ||
    code.startsWith('crm:members:') ||
    code.startsWith('system:user:list') ||
    code.startsWith('system:region:list'),
  )

  await Promise.all([
    replaceRolePermissions(db, superAdmin.id, superAdminCodes, adminUserId),
    replaceRolePermissions(db, admin.id, adminCodes, adminUserId),
    replaceRolePermissions(db, hospitalAccount.id, hospitalAccountCodes, adminUserId),
    replaceRolePermissions(db, customerService.id, customerServiceCodes, adminUserId),
  ]);
}
