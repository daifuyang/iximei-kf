#!/usr/bin/env node
/**
 * 启动 fastify 应用并 dump 出 openapi.json 到 apps/yishan-api/openapi.json。
 * - 仅用于本地 regen OpenAPI spec；不替代 fastify-swagger UI。
 * - 不监听端口：在内存中 `await app.ready()` 然后调 `app.swagger()` 序列化。
 * - 校验 schema 名 crmDashboardStats.hospitalDistribution 存在后写盘退出。
 *
 * 用法：node scripts/dump-openapi.mjs
 *
 * 启动前需要先 build: `npx tsc -p tsconfig.build.json && npx tsc-alias -p tsconfig.build.json`
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = join(__dirname, '..')

// 必须放在 dist 加载之前设置 NODE_ENV，避免 module-loader 加载 dev 路由被剥离。
process.env.NODE_ENV = process.env.NODE_ENV ?? 'development'

const Fastify = (await import('fastify')).default
const fpMod = await import('fastify-plugin')
const fastifyPlugin = fpMod.default
const appMod = await import(join(REPO_ROOT, 'dist', 'app.js'))
const appPlugin = appMod.default
const { options } = appMod

const app = Fastify({
  logger: false,
  trustProxy: options.trustProxy,
  pluginTimeout: 60000,
  ajv: { customOptions: { coerceTypes: 'array', removeAdditional: false } },
})

await app.register(fastifyPlugin(appPlugin))
await app.ready()

// `app.swagger()` returns the generated OpenAPI v3 spec.
const spec = app.swagger()

// sanity check: ensure dashboard schema includes the new field
const stats = spec?.components?.schemas?.crmDashboardStats?.properties
if (!stats || !stats.hospitalDistribution) {
  console.error('[dump-openapi] crmDashboardStats.hospitalDistribution missing')
  await app.close()
  process.exit(1)
}

const outPath = join(REPO_ROOT, 'openapi.json')
writeFileSync(outPath, JSON.stringify(spec, null, 2), 'utf8')
console.log(`[dump-openapi] wrote ${outPath} (${Object.keys(spec.paths ?? {}).length} paths)`)

await app.close()
process.exit(0)