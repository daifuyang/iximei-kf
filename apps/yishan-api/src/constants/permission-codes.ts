/**
 * 权限点编码目录（Permission Code Catalog）
 *
 * Section 1 — RBAC：菜单只负责展示，授权职责统一收敛到 permission code。
 * 命名约定：`<resource>:<entity>:<action>`，例如 `system:user:list`、
 * `shop:product:update`。
 *
 * 路由层通过 `fastify.requirePermission(permCode)` 校验；菜单或插件 manifest
 * 中 `<menuItem.permissionCodes>` 必须引用这里或插件 manifest 中已声明的 code，不能依赖菜单 ID。
 *
 * 新增权限点请同步更新本文件，并在 README/RBAC.md 文档里登记。
 */

/** Permission codes are declared by Core modules or plugin manifests. */
export type PermissionCode = string;

// ============================================================================
// Super Admin Bypass Sentinel
// ============================================================================

/**
 * 内部 sentinel：标记当前请求持有 super_admin 旁路。
 * 由 PermissionService.loadForRoleIds 在角色含 super_admin 时注入 perms；
 * PermissionService.has() 与 role.service.ts 据此短路放行。
 *
 * 这不是 PAT scope 概念 — 是核心 RBAC 的 super_admin 旁路机制。
 */
export const SUPER_ADMIN_BYPASS = "__super_admin__";

// ============================================================================
// 内置角色编码常量
// ============================================================================

/**
 * 内置角色编码常量。注意：超级管理员通过 role.code === SUPER_ADMIN_ROLE_CODE
 * 进行身份判定，禁止使用数据库角色 ID；插件与菜单也只允许引用 code 而非 ID。
 */
export const ROLE_CODES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  NORMAL_USER: "normal_user",
  /** 医院管理：医院相关账号，拥有医院派单查看的权限 */
  HOSPITAL_ACCOUNT: "hospital_account",
  /** 客服管理：客户和派单权限 */
  CUSTOMER_SERVICE: "customer_service",
} as const;

export type RoleCode = typeof ROLE_CODES[keyof typeof ROLE_CODES];
