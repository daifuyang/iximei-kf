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
      category: 'unknown',
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
    expect(execute).toHaveBeenCalledTimes(5)
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
      summary: { total: 0, oral: 0, plastic: 0, unknown: 0, periodNew: 0 },
      byCategory: [], byProvince: [], byCity: [], businessByCategory: [],
    })
    await app.close()
  })
})
