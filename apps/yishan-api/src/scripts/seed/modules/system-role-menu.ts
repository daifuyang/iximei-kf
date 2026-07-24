/**
 * system-role-menu.ts — Section 1 RBAC 种子收尾。
 *
 * 将 sys_role 与 sys_menu 通过 sys_role_menu 关联起来。fork 业务的最终绑定策略：
 *   - super_admin        → 全部菜单
 *   - admin              → 仅 account 菜单（fork 业务：普通管理员无 CRM 权限）
 *   - hospital_account  → /crm/dispatches（及 /crm）+ account
 *   - customer_service  → /crm/customers + /crm/dispatches + /crm/members + account
 *
 * 写入前清空每个 role 的旧绑定（幂等）。
 */

import { and, eq, isNull } from 'drizzle-orm';
import { sysMenu, sysRole, sysRoleMenu } from '@/db/schema';
import { ROLE_CODES } from '@/constants/permission-codes.js';
import type { SeedDb } from '../context.js';

async function findRoleByCode(db: SeedDb, code: string) {
  const row = await db.query.sysRole.findFirst({
    where: and(eq(sysRole.code, code), isNull(sysRole.deletedAt)),
  });
  if (!row) {
    throw new Error(`系统角色缺失 code=${code}，请先运行 ensureSystemRoles`);
  }
  return row;
}

async function listAllMenuPaths(db: SeedDb): Promise<{ id: number; path: string }[]> {
  const rows = await db
    .select({ id: sysMenu.id, path: sysMenu.path })
    .from(sysMenu)
    .where(isNull(sysMenu.deletedAt));
  return rows.filter((r): r is { id: number; path: string } => Boolean(r.path));
}

async function clearRoleMenuBindings(db: SeedDb, roleId: number) {
  await db
    .update(sysRoleMenu)
    .set({ deletedAt: new Date() })
    .where(and(eq(sysRoleMenu.roleId, roleId), isNull(sysRoleMenu.deletedAt)));
}

async function bindRoleMenus(db: SeedDb, roleId: number, menuIds: number[]) {
  if (menuIds.length === 0) return;
  await db
    .insert(sysRoleMenu)
    .values(menuIds.map((menuId) => ({ roleId, menuId })))
    .onDuplicateKeyUpdate({ set: { deletedAt: null } });
}

export async function bindRoleMenusByDefault(db: SeedDb) {
  const superAdmin = await findRoleByCode(db, ROLE_CODES.SUPER_ADMIN);
  const admin = await findRoleByCode(db, ROLE_CODES.ADMIN);
  const hospitalAccount = await db.query.sysRole.findFirst({
    where: and(eq(sysRole.code, ROLE_CODES.HOSPITAL_ACCOUNT), isNull(sysRole.deletedAt)),
  });
  const customerService = await db.query.sysRole.findFirst({
    where: and(eq(sysRole.code, ROLE_CODES.CUSTOMER_SERVICE), isNull(sysRole.deletedAt)),
  });

  const menus = await listAllMenuPaths(db);
  const accountMenuIds = menus.filter((m) => m.path.startsWith('/account')).map((m) => m.id);
  const allMenuIds = menus.map((m) => m.id);

  // 普通管理员: fork 业务下"不配置 CRM 权限" → 菜单只保 account
  const adminMenuIds = accountMenuIds

  // 医院账号: /crm 派单 + account
  const hospitalMenuIds = menus
    .filter((m) => m.path === '/crm' || m.path.startsWith('/crm/dispatches') || m.path.startsWith('/account'))
    .map((m) => m.id)

  // 客服: /crm 客户 + 派单 + 会员 + account（医院档案不开放 → 不含 /crm/hospitals）
  const csMenuIds = menus
    .filter((m) =>
      m.path.startsWith('/crm/customers') ||
      m.path.startsWith('/crm/dispatches') ||
      m.path.startsWith('/crm/members') ||
      m.path === '/crm' ||
      m.path.startsWith('/account'),
    )
    .map((m) => m.id)

  const rolesToReset = [superAdmin.id, admin.id]
  if (hospitalAccount) rolesToReset.push(hospitalAccount.id)
  if (customerService) rolesToReset.push(customerService.id)
  for (const roleId of rolesToReset) {
    await clearRoleMenuBindings(db, roleId)
  }

  await bindRoleMenus(db, superAdmin.id, allMenuIds)
  await bindRoleMenus(db, admin.id, adminMenuIds)
  if (hospitalAccount) {
    await bindRoleMenus(db, hospitalAccount.id, hospitalMenuIds)
  }
  if (customerService) {
    await bindRoleMenus(db, customerService.id, csMenuIds)
  }

  console.log('角色-菜单默认绑定完成:', {
    superAdmin: allMenuIds.length,
    admin: adminMenuIds.length,
    ...(hospitalAccount ? { hospitalAccount: hospitalMenuIds.length } : {}),
    ...(customerService ? { customerService: csMenuIds.length } : {}),
  })
}
