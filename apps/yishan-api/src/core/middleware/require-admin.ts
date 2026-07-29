/**
 * require-admin.ts — 旧版基于 role ID 的管理员判定。
 *
 * Section 1 — RBAC 整改：本文件已迁移为基于 *角色 code* 的判定，使用
 * `PermissionService` 提供的 roleIds 集合。super_admin 自动放行。
 *
 * 推荐：新代码直接用 `fastify.requireRole('超级管理员')` 或
 * `fastify.requirePermission('system:dashboard:read')` 等更细粒度的装饰器。
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { BusinessError } from "../../exceptions/business-error.js";
import { AuthErrorCode } from "../../constants/business-codes/auth.js";
import { ROLE_IDS } from "../../constants/permission-codes.js";
import { PermissionService } from "../services/permission.service.js";

const ADMIN_ROLE_IDS = new Set<number>([
  ROLE_IDS.SUPER_ADMIN,
  ROLE_IDS.ADMIN,
]);

export async function requireAdmin(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const currentUser = (request as any).currentUser;
  const roleIds: number[] = currentUser?.roleIds ?? [];

  if (!roleIds.length) {
    throw new BusinessError(
      AuthErrorCode.FORBIDDEN,
      "需要管理员权限才能访问此接口",
    );
  }

  const { roleIds: activeRoleIds } = await PermissionService.loadForRoleIds(roleIds);
  const isAdmin = [...activeRoleIds].some((id) => ADMIN_ROLE_IDS.has(id));

  if (!isAdmin) {
    throw new BusinessError(
      AuthErrorCode.FORBIDDEN,
      "需要管理员权限才能访问此接口",
    );
  }
}
