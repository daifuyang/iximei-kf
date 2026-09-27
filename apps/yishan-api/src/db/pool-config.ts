import type { PoolOptions } from 'mysql2/promise'

/**
 * Business timestamps are stored as MySQL DATETIME wall-clock values in
 * China Standard Time (no timezone in the column). mysql2 must be told
 * `+08:00` so DATETIME ↔ JS Date conversion is independent of the process
 * TZ (FC runs UTC; local Windows is usually UTC+8).
 *
 * mysql2 `createPool` takes a single argument. `createPool(url, { timezone })`
 * silently drops the second object, which is why FC displayed times 8 hours
 * ahead. Pass `{ uri, timezone }` instead.
 */
export const MYSQL_WALL_CLOCK_TZ = '+08:00'

export function buildDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (env.DATABASE_URL) return env.DATABASE_URL
  if (!env.DATABASE_HOST) return undefined
  const user = env.DATABASE_USER ?? 'root'
  const password = env.DATABASE_PASSWORD ?? ''
  const host = env.DATABASE_HOST
  const port = env.DATABASE_PORT ?? '3306'
  const database = env.DATABASE_NAME ?? ''
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
}

export function buildMysqlPoolConfig(
  env: NodeJS.ProcessEnv = process.env,
): PoolOptions {
  const url = buildDatabaseUrl(env)
  const shared: PoolOptions = {
    timezone: MYSQL_WALL_CLOCK_TZ,
    // DATE columns are calendar days; converting them with timezone would
    // shift birthdays across midnight. DATETIME still uses timezone above.
    dateStrings: ['DATE'],
    waitForConnections: true,
    connectionLimit: 5,
  }
  if (url) return { uri: url, ...shared }
  return {
    host: env.DATABASE_HOST,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    port: env.DATABASE_PORT ? Number(env.DATABASE_PORT) : 3306,
    ...shared,
  }
}
