import 'dotenv/config'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { drizzleDb, pool } from '@/db'
import { seedMenus } from '@/scripts/seed/modules/system-menu.js'
import { bindRoleMenusByDefault } from '@/scripts/seed/modules/system-role-menu.js'
import { seedConfig } from '@/scripts/seed/config.js'

// 加载所有 route 模块,触发 registerPermissions 副作用
function loadCoreRoutePermissions(): void {
  const routesRoot = join(__dirname, '..', 'core', 'routes')
  const stack: string[] = [routesRoot]
  while (stack.length) {
    const dir = stack.pop()!
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        require(full)
      }
    }
  }
}

async function main() {
  console.log('[seed-menus] start')
  loadCoreRoutePermissions()
  console.log('[seed-menus] permissions loaded')

  await seedMenus(drizzleDb as any, 1, [seedConfig.systemMenusSeed, seedConfig.accountMenusSeed])
  console.log('[seed-menus] menus seeded')

  await bindRoleMenusByDefault(drizzleDb as any)
  console.log('[seed-menus] role-menu bindings done')

  await pool.end()
  console.log('[seed-menus] done')
}

main().catch(e => {
  console.error('[seed-menus] failed:', e)
  process.exit(1)
})
