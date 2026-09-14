import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthErrorCode } from '@/constants/business-codes/auth.js'
import { ROLE_IDS } from '@/constants/permission-codes.js'
import { DashboardRepository } from '../repositories/dashboard.repository.js'
import { DashboardService } from '../services/dashboard.service.js'
import dashboardRoutes from '../routes/v1/dashboard/index.js'

function result(rows: unknown[]) {
  return [rows, []]
}

function dumpSql(node: any, seen = new WeakSet()): string {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return String(node)
  if (node instanceof Date) return node.toISOString()
  if (typeof node !== 'object' || seen.has(node)) return ''
  seen.add(node)
  if (Array.isArray(node.value) && node.value.every((value: unknown) => typeof value === 'string')) {
    return node.value.join('')
  }
  if (Array.isArray(node.queryChunks)) return node.queryChunks.map((chunk: any) => dumpSql(chunk, seen)).join('')
  if (node.constructor?.name === 'Param' || node.constructor?.name === 'Placeholder') {
    return dumpSql(node.value, seen)
  }
  if (node.sql) return dumpSql(node.sql, seen)
  return ''
}

describe('DashboardRepository.getHospitalOverview', () => {
  it('normalizes oral, plastic, and unknown groups with numeric zero-rate metrics', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce(result([{
        total: '4', oral_count: '2', plastic_count: '1', unknown_count: '1', period_new: '2',
      }]))
      .mockResolvedValueOnce(result([
        { category: 'oral', hospital_count: '2' },
        { category: 'plastic', hospital_count: '1' },
        { category: 'other-value', hospital_count: '1' },
      ]))
      .mockResolvedValueOnce(result([
        { province_code: 11, province_name: 'Beijing', hospital_count: '4' },
      ]))
      .mockResolvedValueOnce(result([
        { province_code: 11, province_name: 'Beijing', city_code: 1101, city_name: 'Beijing', hospital_count: '4' },
      ]))
      .mockResolvedValueOnce(result([
        { category: 'oral', dispatch_count: '2', arrived_count: '1', deal_count: '1' },
        { category: 'plastic', dispatch_count: '0', arrived_count: '0', deal_count: '0' },
        { category: null, dispatch_count: '1', arrived_count: '0', deal_count: '0' },
      ]))

    const overview = await (DashboardRepository as any).getHospitalOverview({
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T00:00:00.000Z'),
      provinceCode: 11,
      cityCode: 1101,
      status: 1,
    }, { execute })

    expect(overview.summary).toEqual({
      total: 4,
      oral: 2,
      plastic: 1,
      unknown: 1,
      periodNew: 2,
    })
    expect(overview.byCategory).toEqual([
      { category: 'oral', hospitalCount: 2 },
      { category: 'plastic', hospitalCount: 1 },
      { category: 'unknown', hospitalCount: 1 },
    ])
    expect(overview.businessByCategory).toEqual([
      { category: 'oral', dispatchCount: 2, arrivedCount: 1, dealCount: 1, arrivedRate: 50, dealRate: 50 },
      { category: 'plastic', dispatchCount: 0, arrivedCount: 0, dealCount: 0, arrivedRate: 0, dealRate: 0 },
      { category: 'unknown', dispatchCount: 1, arrivedCount: 0, dealCount: 0, arrivedRate: 0, dealRate: 0 },
    ])
    expect(overview.byProvince).toEqual([
      { provinceCode: 11, provinceName: 'Beijing', hospitalCount: 4 },
    ])
    expect(overview.byCity).toEqual([
      { provinceCode: 11, provinceName: 'Beijing', cityCode: 1101, cityName: 'Beijing', hospitalCount: 4 },
    ])
    expect(overview.byCategory.reduce((total: number, row: any) => total + row.hospitalCount, 0)).toBe(overview.summary.total)
    expect(overview.byProvince.reduce((total: number, row: any) => total + row.hospitalCount, 0)).toBe(overview.summary.total)
    expect(overview.byCity.reduce((total: number, row: any) => total + row.hospitalCount, 0)).toBe(overview.summary.total)
    expect(execute).toHaveBeenCalledTimes(5)
  })

  it('binds soft-delete, date, category, region, and status filters to every aggregate query', async () => {
    const execute = vi.fn().mockResolvedValue(result([]))
    await (DashboardRepository as any).getHospitalOverview({
      startDate: new Date('2025-12-31T16:00:00.000Z'),
      endDate: new Date('2026-01-30T16:00:00.000Z'),
      category: 'unknown',
      provinceCode: 11,
      cityCode: 1101,
      status: 1,
    }, { execute })

    const statements = execute.mock.calls.map(([query]: any[]) => dumpSql(query))
    expect(execute).toHaveBeenCalledTimes(5)
    for (const statement of statements) {
      expect(statement).toContain('h.deleted_at IS NULL')
      expect(statement).toContain('h.category')
      expect(statement).toContain('unknown')
      expect(statement).toContain('h.province_id')
      expect(statement).toContain('11')
      expect(statement).toContain('h.city_id')
      expect(statement).toContain('1101')
      expect(statement).toContain('h.status')
    }
    expect(statements[0]).toContain('h.created_at')
    expect(statements[0]).toContain('2025-12-31T16:00:00.000Z')
    expect(statements[0]).toContain('2026-01-31T16:00:00.000Z')
    expect(statements[4]).toContain('d.deleted_at IS NULL')
    expect(statements[4]).toContain('d.created_at')
    expect(statements[4]).toContain('2025-12-31T16:00:00.000Z')
    expect(statements[4]).toContain('2026-01-31T16:00:00.000Z')
  })

  it('falls back to unknown when the deferred category column is unavailable', async () => {
    const unknownColumn = Object.assign(new Error('Unknown column category'), {
      cause: { code: 'ER_BAD_FIELD_ERROR' },
    })
    let calls = 0
    const execute = vi.fn(async () => {
      calls += 1
      if (calls <= 5) throw unknownColumn
      return result(calls === 6
        ? [{ total: '2', oral_count: '0', plastic_count: '0', unknown_count: '2', period_new: '1' }]
        : [])
    })

    const overview = await (DashboardRepository as any).getHospitalOverview({
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T00:00:00.000Z'),
    }, { execute })

    expect(overview.summary).toEqual({ total: 2, oral: 0, plastic: 0, unknown: 2, periodNew: 1 })
    expect(overview.byCategory).toEqual([
      { category: 'oral', hospitalCount: 0 },
      { category: 'plastic', hospitalCount: 0 },
      { category: 'unknown', hospitalCount: 0 },
    ])
    expect(execute).toHaveBeenCalledTimes(10)
  })
})

describe('DashboardRepository.getHospitalOverviewDetails', () => {
  it('uses the overview filters and returns per-hospital operating metrics', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce(result([{
        id: 9,
        hospital_name: 'Union Hospital',
        category: 'oral',
        province_name: 'Beijing',
        city_name: 'Beijing',
        status: 1,
        dispatch_count: '3',
        arrived_count: '2',
        deal_count: '1',
        latest_dispatch_at: '2026-01-20T00:00:00.000Z',
      }]))
      .mockResolvedValueOnce(result([{ total: '1' }]))

    const details = await (DashboardRepository as any).getHospitalOverviewDetails({
      startDate: new Date('2025-12-31T16:00:00.000Z'),
      endDate: new Date('2026-01-30T16:00:00.000Z'),
      category: 'oral',
      provinceCode: 11,
      cityCode: 1101,
      status: 1,
      page: 1,
      pageSize: 10,
    }, { execute })

    expect(details).toEqual({
      list: [{
        id: 9,
        hospitalName: 'Union Hospital',
        category: 'oral',
        provinceName: 'Beijing',
        cityName: 'Beijing',
        status: 1,
        dispatchCount: 3,
        arrivedCount: 2,
        dealCount: 1,
        latestDispatchAt: '2026-01-20T00:00:00.000Z',
      }],
      total: 1,
    })

    const statements = execute.mock.calls.map(([query]: any[]) => dumpSql(query))
    expect(statements[0]).toContain('h.deleted_at IS NULL')
    expect(statements[0]).toContain('h.category')
    expect(statements[0]).toContain('h.province_id')
    expect(statements[0]).toContain('h.city_id')
    expect(statements[0]).toContain('h.status')
    expect(statements[0]).toContain('d.created_at')
    expect(statements[0]).toContain('2025-12-31T16:00:00.000Z')
    expect(statements[0]).toContain('2026-01-31T16:00:00.000Z')
  })
})

describe('DashboardService.getHospitalOverview', () => {
  it('passes inclusive Shanghai date boundaries to the repository', async () => {
    const overview = {
      summary: { total: 0, oral: 0, plastic: 0, unknown: 0, periodNew: 0 },
      byCategory: [], byProvince: [], byCity: [], businessByCategory: [],
    }
    const spy = vi.spyOn(DashboardRepository as any, 'getHospitalOverview').mockResolvedValue(overview)

    const response = await (DashboardService as any).getHospitalOverview(
      1,
      [ROLE_IDS.SUPER_ADMIN],
      1,
      { startDate: '2026-01-01', endDate: '2026-01-31' },
    )

    expect(response.summary.total).toBe(0)
    expect(response.filters).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' })
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      startDate: new Date('2025-12-31T16:00:00.000Z'),
      endDate: new Date('2026-01-30T16:00:00.000Z'),
    }))
  })

  it('rejects hospital accounts before querying the aggregate', async () => {
    const spy = vi.spyOn(DashboardRepository as any, 'getHospitalOverview')

    await expect((DashboardService as any).getHospitalOverview(
      3,
      [ROLE_IDS.HOSPITAL_ACCOUNT],
      1,
      {},
    )).rejects.toMatchObject({ code: AuthErrorCode.FORBIDDEN })

    expect(spy).not.toHaveBeenCalled()
  })

  it('lets super admins access the overview even when they also have the hospital role', async () => {
    const overview = {
      summary: { total: 0, oral: 0, plastic: 0, unknown: 0, periodNew: 0 },
      byCategory: [], byProvince: [], byCity: [], businessByCategory: [],
    }
    const spy = vi.spyOn(DashboardRepository as any, 'getHospitalOverview').mockResolvedValue(overview)

    await expect((DashboardService as any).getHospitalOverview(
      1,
      [ROLE_IDS.HOSPITAL_ACCOUNT, ROLE_IDS.SUPER_ADMIN],
      5,
      {},
    )).resolves.toMatchObject({ summary: { total: 0 } })

    expect(spy).toHaveBeenCalledOnce()
  })

  it('rejects restricted data scopes until a hospital scope mapping exists', async () => {
    const spy = vi.spyOn(DashboardRepository as any, 'getHospitalOverview')

    await expect((DashboardService as any).getHospitalOverview(
      4,
      [ROLE_IDS.CUSTOMER_SERVICE],
      5,
      {},
    )).rejects.toMatchObject({ code: AuthErrorCode.FORBIDDEN })

    expect(spy).not.toHaveBeenCalled()
  })
})

describe('hospital overview route', () => {
  afterEach(() => vi.restoreAllMocks())

  it('serves the aggregate contract with all supported filters', async () => {
    vi.spyOn(DashboardService as any, 'getHospitalOverview').mockResolvedValue({
      generatedAt: '2026-01-31T00:00:00.000Z',
      filters: {
        startDate: '2026-01-01', endDate: '2026-01-31', category: 'oral', provinceCode: 11, cityCode: 1101, status: 1,
      },
      summary: { total: 0, oral: 0, plastic: 0, unknown: 0, periodNew: 0 },
      byCategory: [], byProvince: [], byCity: [], businessByCategory: [],
    })
    const app = Fastify()
    app.decorate('authenticate', async (request: any) => {
      request.currentUser = { id: 1, roleIds: [ROLE_IDS.SUPER_ADMIN], dataScope: 1 }
    })
    app.decorate('requirePermission', () => async () => {})
    await app.register(dashboardRoutes, { prefix: '/api/crm/v1' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/crm/v1/dashboard/hospital-overview?startDate=2026-01-01&endDate=2026-01-31&category=oral&provinceCode=11&cityCode=1101&status=1',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().data).toMatchObject({
      generatedAt: '2026-01-31T00:00:00.000Z',
      filters: {
        startDate: '2026-01-01', endDate: '2026-01-31', category: 'oral', provinceCode: 11, cityCode: 1101, status: 1,
      },
      summary: { total: 0, oral: 0, plastic: 0, unknown: 0, periodNew: 0 },
      byCategory: [], byProvince: [], byCity: [], businessByCategory: [],
    })
    await app.close()
  })

  it('rejects impossible calendar dates with 400 before invoking the service', async () => {
    const service = vi.spyOn(DashboardService as any, 'getHospitalOverview')
    const app = Fastify()
    app.decorate('authenticate', async (request: any) => {
      request.currentUser = { id: 1, roleIds: [ROLE_IDS.SUPER_ADMIN], dataScope: 1 }
    })
    app.decorate('requirePermission', () => async () => {})
    await app.register(dashboardRoutes, { prefix: '/api/crm/v1' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/crm/v1/dashboard/hospital-overview?startDate=2026-02-31&endDate=2026-03-01',
    })

    expect(response.statusCode).toBe(400)
    expect(service).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns a paginated hospital detail response with the overview metric fields', async () => {
    vi.spyOn(DashboardService as any, 'getHospitalOverviewDetails').mockResolvedValue({
      list: [{
        id: 9,
        hospitalName: 'Union Hospital',
        category: 'oral',
        provinceName: 'Beijing',
        cityName: 'Beijing',
        status: 1,
        dispatchCount: 3,
        arrivedCount: 2,
        dealCount: 1,
        latestDispatchAt: '2026-01-20T00:00:00.000Z',
      }],
      total: 1,
    })
    const app = Fastify()
    app.decorate('authenticate', async (request: any) => {
      request.currentUser = { id: 1, roleIds: [ROLE_IDS.SUPER_ADMIN], dataScope: 1 }
    })
    app.decorate('requirePermission', () => async () => {})
    await app.register(dashboardRoutes, { prefix: '/api/crm/v1' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/crm/v1/dashboard/hospital-overview/details?page=1&pageSize=10&category=oral',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      data: [{ dispatchCount: 3, arrivedCount: 2, dealCount: 1, latestDispatchAt: '2026-01-20T00:00:00.000Z' }],
      pagination: { page: 1, pageSize: 10, total: 1 },
    })
    await app.close()
  })

  it.each(['provinceCode=0', 'cityCode=0', 'status=2'])(
    'rejects invalid overview filter %s before invoking the service',
    async (query) => {
      const service = vi.spyOn(DashboardService as any, 'getHospitalOverview')
      const app = Fastify()
      app.decorate('authenticate', async (request: any) => {
        request.currentUser = { id: 1, roleIds: [ROLE_IDS.SUPER_ADMIN], dataScope: 1 }
      })
      app.decorate('requirePermission', () => async () => {})
      await app.register(dashboardRoutes, { prefix: '/api/crm/v1' })

      const response = await app.inject({
        method: 'GET',
        url: `/api/crm/v1/dashboard/hospital-overview?${query}`,
      })

      expect(response.statusCode).toBe(400)
      expect(service).not.toHaveBeenCalled()
      await app.close()
    },
  )
})
