/**
 * Permission catalog — 单一事实源。
 *
 * 每个路由文件就近 export `const PERMS = { ... }` 并调用 `registerPermissions(...)`，
 * 注册副作用在该文件被 import 时执行一次。Fastify @fastify/autoload 与 module autoload
 * 都会让所有 routes 文件被 import，从而完成注册。
 */

export interface PermissionRef {
  readonly code: string;
  readonly label: string;
  readonly group: string;
  readonly description?: string;
}

const REGISTRY: PermissionRef[] = [];
// 启动期 registerPermissions 持续写入；外部通过 PERMISSION_CODES 拿到的是同一个 Set。
// 类型声明为 ReadonlySet<string> 让 TypeScript 卡死外部 add() / delete()，运行时不 freeze。
// 重要：不能在 import 期 eager freeze（如 Object.freeze + 新 Set 快照），
// 否则测试环境下 setup.ts 在 beforeAll 才 import 路由文件、caller 又在 beforeAll 之前
// 第一次访问 PERMISSION_CODES，会冻结成空 Set，路由注册再也填不进来。
const CODES = new Set<string>();

/**
 * 在启动期注册权限声明。每个 `code` 全局唯一；重复注册 throw。
 * 调用时机：本文件被 import 时，由 routes 文件模块顶层副作用触发。
 */
export const registerPermissions = (...defs: readonly PermissionRef[]): void => {
  for (const def of defs) {
    if (!def.code || !def.label || !def.group) {
      throw new Error(`permission declaration requires code, label and group: ${JSON.stringify(def)}`);
    }
    if (CODES.has(def.code)) {
      throw new Error(`duplicate permission declaration: ${def.code}`);
    }
    CODES.add(def.code);
    REGISTRY.push(def);
  }
};

/**
 * 当前已注册的所有 code 集合的只读视图。
 * 外部代码只能 has() / for..of；add() / delete() 由 TypeScript 的 ReadonlySet
 * 类型在编译期拦住，运行时不 freeze（见上方注释）。
 */
export const PERMISSION_CODES: ReadonlySet<string> = CODES;

/** 启动期一次性复制为冻结数组；菜单创建、admin 后台展示使用。 */
export const listPermissions = (): ReadonlyArray<PermissionRef> =>
  Object.freeze([...REGISTRY]);

/**
 * 已知不需要 RBAC 角色持有的"公共"code：login / refresh / 定时任务回调 / 健康检查等。
 * 这些 code 仍然 catalog 注册（用于 OpenAPI、admin UI 展示），但运行时 rbac 跳过权限校验。
 *
 * 子集语义：
 *   - 仅认证身份即可（仍要求 request.currentUser，由 route handler 自校验）：
 *     'auth:profile'、'auth:logout'、后台菜单树、启用字典映射 —— 已登录用户应能获取自己的会话 / 撤销自己的会话，
 *     不该被某个菜单的 perm 字段绑定所限制。
 *   - 完全 public（不挂 authenticate，也不挂 requirePermission）：
 *     'auth:login'、'auth:refresh'、'system:cron'、'system:health'、'system:options:public'
 *     —— 用于登录换取令牌、刷新过期的 access token、健康检查等场景。
 *
 * 注意：上面区分由 route-registrar 的 AUTH_ONLY_CODES 集合配合 BYPASS_CODES 实现，
 * 详见 core/routes/route-registrar.ts。
 */
export const BYPASS_CODES: ReadonlySet<string> = Object.freeze(
  new Set([
    'auth:login',
    'auth:refresh',
    'auth:profile',
    'auth:logout',
    'system:menu:authorized',
    'system:dict:map',
    'system:option:bootstrap',
    'system:cron',
    'system:health',
    'system:options:public',
  ]),
);

export const isBypassCode = (code: string): boolean => BYPASS_CODES.has(code);
