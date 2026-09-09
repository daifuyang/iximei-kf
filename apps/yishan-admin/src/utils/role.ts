import { useModel } from '@umijs/max';
import { ROLE_IDS } from '@/constants/roleIds';

/**
 * 共享角色判断 hook —— 与现有 `HospitalUnviewedBadge/index.tsx`、`app.tsx` 一致消费 `roleIds: number[]`。
 *
 * 后端 `CurrentUser` 类型（`src/types/sdk/auth.ts`）只暴露 `roleIds` + `permissions` 两个数组，
 * 没有 `roleCodes` 字符串字段。前端角色识别一律走数字 `ROLE_IDS`，与 `apps/yishan-api/src/constants/permission-codes.ts` 对齐。
 *
 * super_admin 走 `__super_admin__` bypass sentinel（permission.service 注入），不能用 `roleIds` 判定，
 * 因此 `useIsSuperAdmin` 同时检查 `permissions.includes('__super_admin__')`。
 */

const SUPER_ADMIN_BYPASS = '__super_admin__';

function readRoleIds(user: any): number[] {
  if (!user) return [];
  const ids = user.roleIds;
  return Array.isArray(ids) ? ids : [];
}

function readPermissions(user: any): string[] {
  if (!user) return [];
  const perms = user.permissions;
  return Array.isArray(perms) ? perms : [];
}

export function useCurrentRoleIds(): number[] {
  const { initialState } = useModel('@@initialState');
  return readRoleIds(initialState?.currentUser);
}

export function useCurrentPermissions(): string[] {
  const { initialState } = useModel('@@initialState');
  return readPermissions(initialState?.currentUser);
}

export function useIsSuperAdmin(): boolean {
  const { initialState } = useModel('@@initialState');
  const user = initialState?.currentUser;
  if (readRoleIds(user).includes(ROLE_IDS.SUPER_ADMIN)) return true;
  return readPermissions(user).includes(SUPER_ADMIN_BYPASS);
}

/**
 * 是否医院账号。
 * 判定：roleIds 含 ROLE_IDS.HOSPITAL_ACCOUNT 且不是 super_admin。
 * 单纯"拥有 hospital_account 角色 ID"在某些极端情况可能与别的角色并存（如测试租户临时合并），
 * 与 `HospitalUnviewedBadge` 现有逻辑保持一致语义。
 */
export function useIsHospitalAccount(): boolean {
  const { initialState } = useModel('@@initialState');
  const user = initialState?.currentUser;
  const isSuper = readRoleIds(user).includes(ROLE_IDS.SUPER_ADMIN) ||
    readPermissions(user).includes(SUPER_ADMIN_BYPASS);
  if (isSuper) return false;
  return readRoleIds(user).includes(ROLE_IDS.HOSPITAL_ACCOUNT);
}
