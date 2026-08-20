/**
 * Mirror of apps/yishan-api/src/constants/permission-codes.ts#ROLE_IDS.
 *
 * admin 端 tsconfig 没有 `@api/*` 别名,因此前端在这里手工镜像一份,
 * 与后端保持同步修改 (后端角色 ID 是 seed 与权限校验的真相源)。
 *
 * 角色 ID 是数字 (后端 INT 主键),枚举命名与后端一致:
 *   SUPER_ADMIN       全局超管
 *   ADMIN             普通管理员
 *   HOSPITAL_ACCOUNT  医院账号 (T10 派单 badge 轮询的目标角色)
 *   CUSTOMER_SERVICE  客服
 *   NORMAL_USER       普通用户
 */
export const ROLE_IDS = Object.freeze({
  SUPER_ADMIN: 1,
  ADMIN: 2,
  HOSPITAL_ACCOUNT: 3,
  CUSTOMER_SERVICE: 4,
  NORMAL_USER: 5,
} as const)

export type RoleId = typeof ROLE_IDS[keyof typeof ROLE_IDS]