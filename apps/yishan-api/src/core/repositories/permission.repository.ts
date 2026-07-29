/**
 * Permission Repository
 *
 * Section 3 — Drizzle 链路：所有 DB 访问都走 Repository。
 * 业务层（PermissionService）调用本类即可。
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysRole, sysRolePermission, sysUserRole } from "@/db/schema";

/** 数据权限范围枚举 */
export const DATA_SCOPE = {
  /** 全部数据（无过滤） */
  ALL: 1,
  /** 自定义数据：由 sys_role_dept 指定可访问部门 */
  CUSTOM: 2,
  /** 本部门数据 */
  DEPT: 3,
  /** 本部门及子部门数据 */
  DEPT_AND_CHILDREN: 4,
  /** 仅本人数据 */
  SELF: 5,
} as const

export type DataScopeCode = (typeof DATA_SCOPE)[keyof typeof DATA_SCOPE]

/** 超级管理员身份 ID（与 rbac.ts 中 SUPER_ADMIN_BYPASS 同源）。 */
const SUPER_ADMIN_ID = 1

/**
 * 提升后的 effectiveDataScope：只要用户持有超级管理员角色，视作看全部。
 *
 * 这是与 `__super_admin__` bypass 同源的安全侧门：
 *   - 把"超管"作为身份标记,而不是 dataScope 枚举中的一个具体值
 *   - 任意角色种子(包括 fork 自己的客服 / 医院账号)即使误配 dataScope=1,
 *     只要 code !== '超级管理员' 就仍然走 SELF 隔离
 */
function resolveEffectiveDataScope(roleIds: ReadonlySet<number>, scopes: ReadonlySet<DataScopeCode>): DataScopeCode {
  if (roleIds.has(SUPER_ADMIN_ID) || scopes.has(DATA_SCOPE.ALL)) return DATA_SCOPE.ALL
  // CRM Repository 尚未接入部门集合过滤时，部门/自定义范围必须安全收敛为 SELF，
  // 避免将未实现的范围误解释为全量数据。
  return DATA_SCOPE.SELF
}

export interface PermissionQueryResult {
  perms: Set<string>;
  roleIds: Set<number>;
  /** 各角色 dataScope（无权限的角色不包含） */
  dataScopes: Set<DataScopeCode>;
  /** 多角色聚合后的最终数据权限（最严格） */
  effectiveDataScope: DataScopeCode;
}

export class PermissionRepository {
  /**
 * 加载一组角色 ID 对应的权限点（来自角色 ↔ 独立权限关联）。
   * 返回 Set<string> 类型的权限集合 + 角色 code 集合。
   *
   * Section 1 — RBAC 完整性修复：
   *   - 仅查询 status = "1"（启用）的角色
   *   - 软删除（deletedAt IS NOT NULL）的记录一律排除
   *   - 否则禁用/逻辑删除的角色仍会授予权限，导致与配置状态不一致
   */
  static async loadPermissionsByRoleIds(
    roleIds: number[] | number | undefined | null,
    db: AppQueryDb = drizzleDb,
  ): Promise<PermissionQueryResult> {
    // 确保 roleIds 是一个有效的数字数组
    const normalizedRoleIds = Array.isArray(roleIds)
      ? roleIds
      : (roleIds != null ? [Number(roleIds)] : []);

    // 过滤并转换为有效的数字
    const validRoleIds = normalizedRoleIds
      .map(id => Number(id))
      .filter(id => !isNaN(id) && id > 0);

    if (validRoleIds.length === 0) {
      return {
        perms: new Set<string>(),
        roleIds: new Set<number>(),
        dataScopes: new Set<DataScopeCode>(),
        effectiveDataScope: DATA_SCOPE.CUSTOM,
      };
    }
    const sortedIds = [...new Set(validRoleIds)];
    const [roleRows, permissionLinks] = await Promise.all([
      db
        .select({ id: sysRole.id, dataScope: sysRole.dataScope })
        .from(sysRole)
        .where(
          and(
            inArray(sysRole.id, sortedIds),
            isNull(sysRole.deletedAt),
            eq(sysRole.status, 1),
          ),
        ),
      db
        .select({ roleId: sysRolePermission.roleId, perm: sysRolePermission.permissionCode })
        .from(sysRolePermission)
        .innerJoin(
          sysRole,
          and(
            eq(sysRole.id, sysRolePermission.roleId),
            isNull(sysRole.deletedAt),
            eq(sysRole.status, 1),
          ),
        )
        .where(and(inArray(sysRolePermission.roleId, sortedIds), isNull(sysRolePermission.deletedAt))),
    ]);
    const perms = new Set<string>();
    const activeRoleIds = new Set<number>();
    const dataScopes = new Set<DataScopeCode>();
    for (const row of roleRows) {
      if (row.id) activeRoleIds.add(row.id);
      if (row.id && (row as any).dataScope != null) {
        dataScopes.add((row as any).dataScope as DataScopeCode);
      }
    }
    for (const link of permissionLinks) {
      if (link.perm) perms.add(link.perm);
    }
    // 关键:super_admin 身份覆盖 dataScope,即便多角色里有其它 SELF 也强制 ALL。
    const effectiveDataScope = resolveEffectiveDataScope(activeRoleIds, dataScopes)
    return { perms, roleIds: activeRoleIds, dataScopes, effectiveDataScope }
  }

  /** 当前用户的活跃 role IDs。 */
  static async loadActiveRoleIdsByUserId(
    userId: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<number[]> {
    const rows = await db
      .select({ roleId: sysUserRole.roleId })
      .from(sysUserRole)
      .where(and(eq(sysUserRole.userId, userId), isNull(sysUserRole.deletedAt)));
    return rows.map((r) => r.roleId);
  }
}
