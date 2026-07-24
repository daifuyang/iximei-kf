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
  /** 本部门数据 */
  DEPT: 2,
  /** 本部门及子部门数据 */
  DEPT_AND_CHILDREN: 3,
  /** 仅本人数据 */
  SELF: 4,
  /** 自定义数据：按模块/实体各自的语义计算 */
  CUSTOM: 5,
} as const

export type DataScopeCode = (typeof DATA_SCOPE)[keyof typeof DATA_SCOPE]

/** dataScope 数值 → 严格度（数字越小越宽）。多角色取最严格。 */
const SCOPE_STRICTNESS: Record<DataScopeCode, number> = {
  1: 5, // ALL 最宽松
  2: 3, // DEPT
  3: 2, // DEPT_AND_CHILDREN
  4: 4, // SELF
  5: 1, // CUSTOM 最严格（具体语义交给各模块 entity）
}
const NUM_STRICTNESS: Record<number, number> = SCOPE_STRICTNESS

/** 多角色聚合：取严格度最高（数值最小）的那个 */
export function minimizeDataScope(scopes: ReadonlyArray<DataScopeCode>): DataScopeCode {
  if (scopes.length === 0) return DATA_SCOPE.CUSTOM
  let best: DataScopeCode = DATA_SCOPE.ALL
  let bestStrictness = NUM_STRICTNESS[best]
  for (const s of scopes) {
    const cur = NUM_STRICTNESS[s] ?? bestStrictness
    if (cur < bestStrictness) {
      best = s
      bestStrictness = cur
    }
  }
  return best
}

export interface PermissionQueryResult {
  perms: Set<string>;
  roleCodes: Set<string>;
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
        roleCodes: new Set<string>(),
        dataScopes: new Set<DataScopeCode>(),
        effectiveDataScope: DATA_SCOPE.CUSTOM,
      };
    }
    const sortedIds = [...new Set(validRoleIds)];
    const [roleRows, permissionLinks] = await Promise.all([
      db
        .select({ id: sysRole.id, code: sysRole.code, dataScope: sysRole.dataScope })
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
    const roleCodes = new Set<string>();
    const dataScopes = new Set<DataScopeCode>();
    for (const row of roleRows) {
      if (row.code) roleCodes.add(row.code);
      if (row.id && (row as any).dataScope != null) {
        dataScopes.add((row as any).dataScope as DataScopeCode);
      }
    }
    for (const link of permissionLinks) {
      if (link.perm) perms.add(link.perm);
    }
    return { perms, roleCodes, dataScopes, effectiveDataScope: minimizeDataScope([...dataScopes]) };
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
