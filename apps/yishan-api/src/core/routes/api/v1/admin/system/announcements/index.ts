/**
 * 系统公告权限码声明。
 *
 * 此文件不声明任何实际路由（公告页是前端静态展示，无后端 API）。
 * 唯一作用是顶层副作用：被 seed 的 loadCoreRoutePermissions 扫到后，
 * 把 system:announcement:read 加入 PERMISSION_CODES catalog，
 * 让 system-menus.json 里的「系统公告」菜单通过 seed 时的菜单校验。
 *
 * 文件名以 .ts 结尾但不放任何 route/fastify plugin，编译产物只含
 * registerPermissions 这一行顶层调用，fastify 加载时会忽略这个模块
 * （因为它不是 FastifyPluginAsync default export）。
 */
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  READ: { code: 'system:announcement:read', label: '系统公告-查看', group: 'system' },
});
registerPermissions(...Object.values(PERMS));