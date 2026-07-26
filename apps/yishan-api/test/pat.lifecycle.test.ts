/**
 * PAT 生命周期端到端测试
 *
 * 覆盖 authenticate 装饰器在 PAT 分支上的所有拒绝路径：
 *   1. 到期拒绝          — findByRawToken 返回 null（已实现 expiresAt 检查）
 *   2. 撤销拒绝          — findByRawToken 返回 null（deletedAt 不为 null）
 *   3. 用户禁用拒绝      — currentUser.status === "0"
 *   4. 用户锁定拒绝      — currentUser.status === "2"
 *   5. 有效 PAT 认证     — 认证成功，touch 被调用
 *
 * PAT 权限不再由 scopes 控制 — 认证后继承用户当前 RBAC 角色权限。
 */

import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import authPlugin from '../src/core/routes/api/v1/auth/index.ts'
import registerAuthSchemas from '../src/core/schemas/auth.ts'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import jwtAuthPlugin from '../src/core/plugins/external/jwt-auth.ts'
import { ApiTokenRepository } from '../src/core/repositories/api-token.repository.ts'
import { UserService } from '../src/core/services/user.service.ts'
import { MenuService } from '../src/core/services/menu.service.ts'
import { AuthErrorCode } from '../src/constants/business-codes/auth.ts'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Shared fixtures
// ============================================================================

const RAW_PAT = 'yishan_pat_testtoken12345'

const VALID_PAT_RECORD = {
  id: 10,
  name: 'ci-token',
  userId: 1,
  expiresAt: null,
  lastUsedAt: null,
  lastUsedIp: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const ACTIVE_USER = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  realName: 'Admin',
  gender: '1',
  genderName: '男',
  status: '1',
  statusName: '启用',
  loginCount: 10,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLoginTime: new Date().toISOString(),
  roleIds: [1],
}

const DISABLED_USER = { ...ACTIVE_USER, status: '0', statusName: '禁用' }
const LOCKED_USER = { ...ACTIVE_USER, status: '2', statusName: '锁定' }
const SUPER_ADMIN_USER = { ...ACTIVE_USER, roleIds: [999] }

async function buildPatAuthApp(overrides?: {
  findByRawTokenResult?: typeof VALID_PAT_RECORD | null
  userResult?: typeof ACTIVE_USER | null
}) {
  const app = Fastify({ logger: false })
  app.decorate('rateLimit', () => async () => undefined)
  await app.register(errorHandlerPlugin)
  await app.register(fastifyCookie)
  await app.register(jwtAuthPlugin)
  registerAuthSchemas(app)

  vi.spyOn(ApiTokenRepository, 'findByRawToken').mockImplementation(async (raw: string) => {
    if (raw !== RAW_PAT) return null
    return overrides?.findByRawTokenResult ?? null
  })

  vi.spyOn(ApiTokenRepository, 'touch').mockResolvedValue(undefined)

  vi.spyOn(UserService, 'getUserById').mockImplementation(async (id: number) => {
    if (id !== 1) return null
    return overrides?.userResult ?? null
  })

  vi.spyOn(MenuService, 'getAuthorizedMenuPaths').mockResolvedValue(['/dashboard'])

  await app.register(authPlugin, { prefix: '/api/v1/auth' })
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ============================================================================
// Lifecycle: expiry, revocation, user status
// ============================================================================

describe('PAT lifecycle: findByRawToken returns null → API_TOKEN_NOT_FOUND', () => {
  it('已过期的 PAT（expiresAt < now）被拒绝', async () => {
    // findByRawToken 在 SQL 层过滤过期记录，返回 null
    // 模拟：token 存在但已过期（findByRawToken 会因 expiresAt 检查而返回 null）
    const app = await buildPatAuthApp({ findByRawTokenResult: null })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${RAW_PAT}` },
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.code).toBe(AuthErrorCode.API_TOKEN_NOT_FOUND)
    expect(body.message).toMatch(/已过期|不存在/)

    await app.close()
  })

  it('已撤销的 PAT（deletedAt 不为 null）被拒绝', async () => {
    // findByRawToken 已排除 deletedAt 不为 null 的记录，返回 null 即表示撤销/不存在
    const app = await buildPatAuthApp({ findByRawTokenResult: null })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${RAW_PAT}` },
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.code).toBe(AuthErrorCode.API_TOKEN_NOT_FOUND)

    await app.close()
  })
})

describe('PAT lifecycle: user status checks', () => {
  it('关联用户已被禁用（status="0"）→ API_TOKEN_REVOKED', async () => {
    const app = await buildPatAuthApp({
      findByRawTokenResult: VALID_PAT_RECORD,
      userResult: DISABLED_USER as any,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${RAW_PAT}` },
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.code).toBe(AuthErrorCode.API_TOKEN_REVOKED)
    expect(body.message).toMatch(/禁用/)

    await app.close()
  })

  it('关联用户已被锁定（status="2"）→ API_TOKEN_REVOKED', async () => {
    const app = await buildPatAuthApp({
      findByRawTokenResult: VALID_PAT_RECORD,
      userResult: LOCKED_USER as any,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${RAW_PAT}` },
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.code).toBe(AuthErrorCode.API_TOKEN_REVOKED)
    expect(body.message).toMatch(/锁定/)

    await app.close()
  })
})

// ============================================================================
// Lifecycle: valid PAT authentication
// ============================================================================

describe('PAT lifecycle: valid token authentication', () => {
  it('有效 PAT 认证成功', async () => {
    const app = await buildPatAuthApp({
      findByRawTokenResult: VALID_PAT_RECORD,
      userResult: ACTIVE_USER as any,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${RAW_PAT}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.username).toBe('admin')

    await app.close()
  })

  it('PAT touch 被调用以更新 lastUsedAt / lastUsedIp', async () => {
    const app = await buildPatAuthApp({
      findByRawTokenResult: VALID_PAT_RECORD,
      userResult: ACTIVE_USER as any,
    })

    await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${RAW_PAT}` },
    })

    // touch 用 setImmediate 异步调用，等待事件循环处理
    await new Promise((resolve) => setImmediate(resolve))
    expect(ApiTokenRepository.touch).toHaveBeenCalledWith(10, expect.any(String))

    await app.close()
  })
})
