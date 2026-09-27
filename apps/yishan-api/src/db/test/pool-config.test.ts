import { describe, expect, it } from 'vitest'
import { MYSQL_WALL_CLOCK_TZ, buildMysqlPoolConfig } from '../pool-config.js'

describe('buildMysqlPoolConfig', () => {
  it('keeps timezone on the same config object when DATABASE_URL is set', () => {
    const cfg = buildMysqlPoolConfig({
      DATABASE_URL: 'mysql://app:secret@127.0.0.1:3306/iximei-crm',
    })
    expect(cfg.uri).toBe('mysql://app:secret@127.0.0.1:3306/iximei-crm')
    expect(cfg.timezone).toBe(MYSQL_WALL_CLOCK_TZ)
    expect(cfg.dateStrings).toEqual(['DATE'])
    expect(cfg.connectionLimit).toBe(5)
  })

  it('builds uri from discrete DATABASE_* vars and still sets timezone', () => {
    const cfg = buildMysqlPoolConfig({
      DATABASE_HOST: '127.0.0.1',
      DATABASE_PORT: '3306',
      DATABASE_USER: 'root',
      DATABASE_PASSWORD: 'x',
      DATABASE_NAME: 'iximei-crm',
    })
    expect(cfg.uri).toMatch(/^mysql:\/\/root:x@127\.0\.0\.1:3306\/iximei-crm$/)
    expect(cfg.timezone).toBe('+08:00')
    expect(cfg.dateStrings).toEqual(['DATE'])
  })
})
