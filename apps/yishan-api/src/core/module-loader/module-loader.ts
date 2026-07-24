/**
 * module-loader.ts — 单一职责：管理业务模块的装载与卸载。
 *
 * 模块启停的事实源是 MySQL `sys_module.enabled`。本文件封装三件事：
 *   1. `syncModulesFromDisk`：扫 dist/modules/<id>/,INSERT 缺失行(默认 enabled = 1)、
 *      UPDATE 结构字段(name / table_prefix / version)。永远不动 `enabled` 列。
 *   2. `loadEnabledModuleIds`：从 DB 读取 enabled = 1 的 id 集合,带 Redis 缓存。
 *   3. `mountAllOnDisk`：boot 期用标准 @fastify/autoload 挂载所有【已打包在盘上】的模块,
 *      prefix 硬约定 /api/<id>。运行时启停不改挂载,由 app.ts 的 onRequest gate
 *      按 sys_module.enabled 拦截实现(即时、零重启)。
 *
 * 不变量：
 *   - 路由 prefix 硬约定为 `/api/${id}`,不再由模块 meta 声明,也不做 prefix 唯一性校验
 *     (id 唯一性由文件系统保证)。
 *   - fastify 插件树 boot 后不可变：不做运行时 register/unregister;启停走 gate 拦截。
 *   - syncModulesFromDisk 不允许覆盖 enabled;运维显式停用的模块,重启后必须保持停用。
 *   - **入口一律 dist**：dev 与 prod 都从编译产物读。
 *     `npm run dev` 默认 `npm run build:ts` 后再启动,运行时不再 import 任何 .ts。
 *     这避免了 CJS 包对 .ts ESM 语法的拒绝,dev/prod 行为完全一致。
 *     模块作者只关心 src/,build pipeline 决定 dist/ 是否就绪。
 */
import { eq, inArray } from 'drizzle-orm'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import AutoLoad from '@fastify/autoload'
import type { FastifyInstance, FastifyPluginAsync, FastifyBaseLogger } from 'fastify'
import { type AppDb } from '@/db'
import { sysModule } from '@/db/schema/tables'

const REDIS_ENABLED_KEY = 'yishan:modules:enabled'
const REDIS_CACHE_TTL_SECONDS = 60

/** 模块路由 prefix 硬约定;不再由模块 meta 声明。 */
export function moduleRoutePrefix(id: string): string {
  return `/api/${id}`
}

/**
 * 纯函数版 scanDiskModules:统一从 dist 编译产物读取。
 *
 * 仅当 `dist/modules/<id>/module.js` 存在时该模块被视为有效;缺则 warn 并跳过。
 * 开发模式请使用 `npm run dev`（会自动 `build:ts + watch`）,或先单独跑 `build:ts`。
 *
 * 返回 ModuleDiskMeta[] 供 syncModulesFromDiskPure 等下游使用。
 */
export async function scanDiskModulesPure(
  srcRoot: string,
  distRoot: string,
  logger?: FastifyBaseLogger,
): Promise<ModuleDiskMeta[]> {
  const srcModulesDir = join(srcRoot, 'modules')
  if (!existsSync(srcModulesDir)) return []
  const out: ModuleDiskMeta[] = []
  for (const id of readdirSync(srcModulesDir)) {
    const srcModuleDir = join(srcModulesDir, id)
    if (!statSync(srcModuleDir).isDirectory()) continue
    const distModuleJs = join(distRoot, 'modules', id, 'module.js')
    if (!existsSync(distModuleJs)) {
      logger?.warn(
        { module: id },
        'module skipped: dist/modules/<id>/module.js missing — run `pnpm --filter yishan-api build:ts` first',
      )
      continue
    }
    const mod: {
      meta?: Partial<ModuleDiskMeta & { name?: string; enabled?: boolean }>
    } = await import(distModuleJs)
    const meta = mod.meta
    if (!meta?.id || typeof meta.id !== 'string') {
      logger?.warn({ module: id }, 'module skipped: meta.id missing')
      continue
    }
    out.push({
      id: meta.id,
      name: typeof meta.name === 'string' && meta.name.length > 0 ? meta.name : meta.id,
      enabled: meta.enabled === undefined ? true : Boolean(meta.enabled),
      tablePrefix: typeof meta.tablePrefix === 'string' && meta.tablePrefix.length > 0
        ? meta.tablePrefix
        : `${meta.id}_`,
      version: typeof meta.version === 'string' && meta.version.length > 0
        ? meta.version
        : '0.0.0',
      moduleDir: srcModuleDir,
    })
  }
  out.sort((a, b) => a.id.localeCompare(b.id))
  return out
}

/**
 * 纯函数版 syncModulesFromDisk:不依赖 fastify/ModuleLoader 实例,
 * 任何能拿到 drizzle db 句柄的地方都能调用(onboard-modules.ts、reset 脚本等)。
 *
 * 行为：
 *   - 行不存在 → INSERT(默认 enabled = m.enabled ? 1 : 0)
 *   - 行已存在 → UPDATE name / tablePrefix / version / updated_at;enabled 列永不动
 *   - 磁盘不存在但 DB 里存在 → 不处理,留给运维手动卸载
 */
export async function syncModulesFromDiskPure(
  db: AppDb,
  diskModules: ModuleDiskMeta[],
): Promise<{ inserted: number; updated: number }> {
  const ids = diskModules.map((m) => m.id)
  const existing = ids.length === 0
    ? []
    : await db.select({ id: sysModule.id }).from(sysModule).where(inArray(sysModule.id, ids))
  const existingSet = new Set(existing.map((r) => r.id))

  let inserted = 0
  let updated = 0
  for (const m of diskModules) {
    if (existingSet.has(m.id)) {
      await db
        .update(sysModule)
        .set({
          name: m.name,
          tablePrefix: m.tablePrefix,
          version: m.version,
          updatedAt: new Date(),
        })
        .where(eq(sysModule.id, m.id))
      updated++
    } else {
      await db.insert(sysModule).values({
        id: m.id,
        name: m.name,
        tablePrefix: m.tablePrefix,
        version: m.version,
        enabled: m.enabled ? 1 : 0,
      })
      inserted++
    }
  }
  return { inserted, updated }
}

// ────────────────────────────────────────────────────────────────────────────
// 类封装：把 fastify 实例 + 路径 + Redis 缓存绑在一起,提供 boot 期同步装载。
// ────────────────────────────────────────────────────────────────────────────

export interface ModuleDiskMeta {
  id: string
  name: string
  enabled: boolean
  tablePrefix: string
  version: string
  moduleDir: string
}

/**
 * Redis + DB 缓存启用模块 id 集合。
 *   - DB 是事实源(sys_module.enabled = 1)
 *   - Redis 缓存 60s,降低冷启后的逐请求 DB 查询
 */
async function loadEnabledModuleIdsCached(
  redisGet: (key: string) => Promise<string | null>,
  redisSet: (key: string, value: string, ttlSec: number) => Promise<void>,
  db: AppDb,
): Promise<Set<string>> {
  const cached = await redisGet(REDIS_ENABLED_KEY).catch(() => null)
  if (cached) {
    try {
      return new Set(JSON.parse(cached) as string[])
    } catch {
      // 损坏的缓存条目 → 走 DB 回源
    }
  }
  const rows = await db
    .select({ id: sysModule.id, enabled: sysModule.enabled })
    .from(sysModule)
  const enabledIds = rows.filter((r) => Number(r.enabled) === 1).map((r) => r.id)
  await redisSet(REDIS_ENABLED_KEY, JSON.stringify(enabledIds), REDIS_CACHE_TTL_SECONDS).catch(() => {})
  return new Set(enabledIds)
}

export interface ModuleLoaderOptions {
  /** Redis 客户端(getter),仅做 enabled 集合缓存用 */
  redis?: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string, ttlSec: number) => Promise<void>
  }
}

export class ModuleLoader {
  private readonly fastify: FastifyInstance
  private readonly srcRoot: string
  private readonly distRoot: string
  private readonly redis?: ModuleLoaderOptions['redis']
  private readonly mounted = new Set<string>()

  constructor(fastify: FastifyInstance, srcRoot: string, distRoot: string, options: ModuleLoaderOptions = {}) {
    this.fastify = fastify
    this.srcRoot = srcRoot
    this.distRoot = distRoot
    this.redis = options.redis
  }

  /**
   * 扫 dist + 同步 sys_module 行(从 dist 装载 meta,运行时不 import 任何 src)。
   */
  async scanDiskModules(): Promise<ModuleDiskMeta[]> {
    return scanDiskModulesPure(this.srcRoot, this.distRoot, this.fastify.log)
  }

  async syncModulesFromDisk(diskModules: ModuleDiskMeta[]): Promise<{ inserted: number; updated: number }> {
    const db = (this.fastify as unknown as { drizzleDb: AppDb }).drizzleDb
    if (!db) throw new Error('ModuleLoader.syncModulesFromDisk: drizzleDb not registered on fastify instance')
    return syncModulesFromDiskPure(db, diskModules)
  }

  /**
   * 当前进程内挂载过的模块 id 集合。
   * onRequest gate 用它匹配 /api/<id>/...。
   */
  listModuleIds(): Set<string> {
    return new Set(this.mounted)
  }

  /**
   * 单 id 查询是否已在 boot 阶段挂载。
   * Dev 工具 `/system/module-management/list` 用它报告 state。
   */
  isMounted(id: string): boolean {
    return this.mounted.has(id)
  }

  /**
   * 清掉 Redis 上的 enabled 缓存,下次 enabledIdsCached() 走 DB 重新计算。
   * Dev 工具 `/system/module-management/toggle` 在启停模块后调用。
   */
  async invalidateEnabledCache(): Promise<void> {
    if (!this.redis) return
    await this.redis.set(REDIS_ENABLED_KEY, '[]', 0).catch(() => {})
  }

  /**
   * 当前启用的模块 id 集合(DB 事实源 + Redis 缓存)。
   */
  async enabledIdsCached(): Promise<Set<string>> {
    const db = (this.fastify as unknown as { drizzleDb: AppDb }).drizzleDb
    if (!db) return new Set()
    if (!this.redis) {
      return loadEnabledModuleIdsCached(
        async () => null,
        async () => {},
        db,
      )
    }
    return loadEnabledModuleIdsCached(this.redis.get, this.redis.set, db)
  }

  /**
   * 用标准 @fastify/autoload 挂载单个模块的 routes/ 目录,prefix 硬约定 /api/<id>。
   * 仅从 dist 装载（与 scanDiskModulesPure 一致）。
   */
  private async mountModuleRoutes(meta: ModuleDiskMeta): Promise<void> {
    if (this.mounted.has(meta.id)) return
    const distRoutesDir = join(this.distRoot, 'modules', meta.id, 'routes')
    if (!existsSync(distRoutesDir)) {
      this.fastify.log.warn(
        { module: meta.id },
        'module skipped: dist/routes/ directory missing — run `pnpm --filter yishan-api build:ts` first',
      )
      return
    }
    const prefix = moduleRoutePrefix(meta.id)
    await this.fastify.register(AutoLoad, {
      dir: distRoutesDir,
      autoHooks: true,
      cascadeHooks: true,
      options: { prefix },
    })
    this.mounted.add(meta.id)
    this.fastify.log.info({ module: meta.id, prefix }, 'module mounted')
  }

  /**
   * boot 时挂载所有磁盘模块(不看 enabled)。运行时启停交给 gate。
   *
   * 各模块互不依赖（fastify.register 隔离上下文），并发起 register 不需要
   * 串行等待——并行挂载在 20+ 模块规模下能把 boot 时间从 O(N) 砍到 O(1)。
   */
  async mountAllOnDisk(diskModules: ModuleDiskMeta[]): Promise<void> {
    await Promise.all(diskModules.map((meta) => this.mountModuleRoutes(meta)))
  }
}

// 让 fastify type 顺手通过：
void (null as unknown as FastifyPluginAsync)
