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
// 内置角色 ID 常量
// ============================================================================

/**
 * 内置角色 ID。core 初始迁移与系统角色 seed 固定以下 ID；后端身份判断只能使用该常量，
 * `sys_role.name` 仅用于展示与 seed 数据定位。
 */
export const ROLE_IDS = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  /** 医院管理：医院相关账号，拥有医院派单查看的权限 */
  HOSPITAL_ACCOUNT: 3,
  /** 客服管理：客户和派单权限 */
  CUSTOMER_SERVICE: 4,
} as const;

export type RoleId = typeof ROLE_IDS[keyof typeof ROLE_IDS];
