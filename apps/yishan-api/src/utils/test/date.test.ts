import { describe, expect, it } from 'vitest'
import { dateUtils } from '../date.js'

describe('dateUtils Shanghai calendar', () => {
  it('maps 10:00 CST to the same calendar day and to 02:00Z ISO', () => {
    const instant = new Date('2026-09-23T02:00:00.000Z')
    expect(dateUtils.formatShanghaiYmd(instant)).toBe('2026-09-23')
    expect(dateUtils.formatISO(instant)).toBe('2026-09-23T02:00:00.000Z')
    expect(dateUtils.shanghaiDayStart(instant).toISOString()).toBe('2026-09-22T16:00:00.000Z')
  })

  it('keeps 00:30 CST on the new calendar day, not the previous UTC date', () => {
    const instant = new Date('2026-09-22T16:30:00.000Z')
    expect(dateUtils.formatShanghaiYmd(instant)).toBe('2026-09-23')
    expect(dateUtils.shanghaiDayStart(instant).toISOString()).toBe('2026-09-22T16:00:00.000Z')
  })

  it('keeps 23:59 CST on that calendar day', () => {
    const instant = new Date('2026-09-22T15:59:00.000Z')
    expect(dateUtils.formatShanghaiYmd(instant)).toBe('2026-09-22')
  })

  it('parses YYYY-MM-DD as Shanghai midnight', () => {
    expect(dateUtils.parseShanghaiDate('2026-09-23')?.toISOString()).toBe(
      '2026-09-22T16:00:00.000Z',
    )
    expect(dateUtils.parseShanghaiDate('2026-02-31')).toBeNull()
    expect(dateUtils.parseShanghaiDate('not-a-date')).toBeNull()
  })

  it('week start is Monday 00:00 Shanghai', () => {
    // 2026-09-23 is Wednesday CST
    const wed = new Date('2026-09-23T02:00:00.000Z')
    expect(dateUtils.shanghaiWeekStart(wed).toISOString()).toBe('2026-09-20T16:00:00.000Z')
    expect(dateUtils.formatShanghaiYmd(dateUtils.shanghaiWeekStart(wed))).toBe('2026-09-21')
  })

  it('month/year starts are Shanghai calendar boundaries', () => {
    const instant = new Date('2026-09-23T02:00:00.000Z')
    expect(dateUtils.shanghaiMonthStart(instant).toISOString()).toBe('2026-08-31T16:00:00.000Z')
    expect(dateUtils.shanghaiYearStart(instant).toISOString()).toBe('2025-12-31T16:00:00.000Z')
  })

  it('parses MySQL DATETIME wall-clock as Asia/Shanghai, not UTC', () => {
    expect(dateUtils.parseMysqlDateTime('2026-09-22 17:06:22').toISOString()).toBe(
      '2026-09-22T09:06:22.000Z',
    )
    expect(dateUtils.formatShanghaiDateTime(new Date('2026-09-22T09:06:22.000Z'))).toBe(
      '2026-09-22 17:06:22',
    )
  })
})
