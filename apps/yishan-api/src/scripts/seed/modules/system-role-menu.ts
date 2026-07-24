/**
 * system-role-menu.ts — Section 1 RBAC 种子收尾。
 *
 * 将 sys_role 与 sys_menu 通过 sys_role_menu 关联起来。默认绑定策略：
 *   - super_admin  → 全部菜单
 *   - admin        → 全部菜单（除系统级敏感路径：插件管理、站点配置、云存储）
 *   - normal_user  → 仅 account 菜单（个人中心、API Token）
 *
 * 写入前清空每个 role 的旧绑定（幂等）。
 */

import { and, eq, isNull } from 'drizzle-orm';
import { sysMenu, sysRole, sysRoleMenu } from '@/db/schema';
import { ROLE_CODES } from '@/constants/permission-codes.js';
import type { SeedDb } from '../context.js';

const ADMIN_EXCLUDED_PATH_PATTERNS = [
  '/system/plugins%',
  '/system/site%',
  '/system/storage%',
];

function isAdminExcluded(path: string): boolean {
  return ADMIN_EXCLUDED_PATH_PATTERNS.some((p) => {
    const prefix = p.endsWith('%') ? p.slice(0, -1) : p;
    return path.startsWith(prefix);
  });
}

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

async function bindRoleMenus(
  db: SeedDb,
  roleId: number,
  menuIds: number[],
) {
  if (menuIds.length === 0) return;
  await db
    .insert(sysRoleMenu)
    .values(menuIds.map((menuId) => ({ roleId, menuId })))
    .onDuplicateKeyUpdate({ set: { deletedAt: null } });
}

/**
 * 默认绑定入口。一次性写出 super_admin/admin/normal_user 三种角色与菜单的关联。
 * 任何先前未在 sys_role_menu 中以 deletedAt IS NULL 存在的旧绑定都会被软删除，
 * 然后按当前策略重新写入（幂等）。
 */
export async function bindRoleMenusByDefault(db: SeedDb) {
  const superAdmin = await findRoleByCode(db, ROLE_CODES.SUPER_ADMIN);
  const admin = await findRoleByCode(db, ROLE_CODES.ADMIN);
  const normalUser = await db.query.sysRole.findFirst({
    where: and(eq(sysRole.code, ROLE_CODES.NORMAL_USER), isNull(sysRole.deletedAt)),
  });
  const hospitalAccount = await db.query.sysRole.findFirst({
    where: and(eq(sysRole.code, ROLE_CODES.HOSPITAL_ACCOUNT), isNull(sysRole.deletedAt)),
  });
  const customerService = await db.query.sysRole.findFirst({
    where: and(eq(sysRole.code, ROLE_CODES.CUSTOMER_SERVICE), isNull(sysRole.deletedAt)),
  });

  const menus = await listAllMenuPaths(db);
  const accountMenuIds = menus
    .filter((m) => m.path.startsWith('/account'))
    .map((m) => m.id);
  const allMenuIds = menus.map((m) => m.id);
  const adminMenuIds = menus
    .filter((m) => !isAdminExcluded(m.path))
    .map((m) => m.id);

  /** 医院管理：CRM 医院 + 派单菜单 */
  const hospitalMenuIds = menus
    .filter((m) => m.path.startsWith('/crm/hospitals') || m.path.startsWith('/crm/dispatches'))
    .map((m) => m.id);

  /** 客服管理：CRM 客户 + 派单菜单 + 个人中心（不含会员顾客 — 仅 super/admin 可访问） */
  const csMenuIds = menus
    .filter((m) => m.path.startsWith('/crm/customers') || m.path.startsWith('/crm/dispatches') || m.path.startsWith('/account'))
    .map((m) => m.id);

  const rolesToReset = [superAdmin.id, admin.id];
  if (normalUser) rolesToReset.push(normalUser.id);
  if (hospitalAccount) rolesToReset.push(hospitalAccount.id);
  if (customerService) rolesToReset.push(customerService.id);
  for (const roleId of rolesToReset) {
    await clearRoleMenuBindings(db, roleId);
  }

  await bindRoleMenus(db, superAdmin.id, allMenuIds);
  await bindRoleMenus(db, admin.id, adminMenuIds);
  if (normalUser) {
    await bindRoleMenus(db, normalUser.id, accountMenuIds);
  }
  if (hospitalAccount) {
    await bindRoleMenus(db, hospitalAccount.id, hospitalMenuIds);
  }
  if (customerService) {
    await bindRoleMenus(db, customerService.id, csMenuIds);
  }

  console.log('角色-菜单默认绑定完成:', {
    superAdmin: allMenuIds.length,
    admin: adminMenuIds.length,
    ...(normalUser ? { normalUser: accountMenuIds.length } : {}),
    ...(hospitalAccount ? { hospitalAccount: hospitalMenuIds.length } : {}),
    ...(customerService ? { customerService: csMenuIds.length } : {}),
  });
}
