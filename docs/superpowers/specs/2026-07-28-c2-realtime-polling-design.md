# Phase C.2 实时数据推送（Smart Polling + Cache Invalidation）设计

> 日期：2026-07-28
> 范围：Phase C 三个子项目中的第二个 —— 替代/增强现有 60s 轮询
> 部署约束：阿里云函数计算（FC3）**不支持 WebSocket / SSE / 长连接**，只能走短连接方案
> 依赖：Phase A 全部 + Phase B 全部（含 HospitalUnviewedBadge 60s 轮询）+ Phase C.1 看板图表
> 不在本 spec：C.3 业绩排行（另立 spec）

## 0. 背景与动机

Phase B T10 已落地 60s 轮询（HospitalUnviewedBadge + getHospitalUnviewedCount），Phase C.1 加了 dashboard trend 也是 60s 轮询。
**问题**：
- 60s 延迟太高（医院账号提交跟进后 1 分钟内看不到状态变化）
- 重复 SQL aggregate（每次轮询都跑同一条 SQL）
- 派单 / 跟进 / 查看 发生时不主动通知医院

**约束**：
- FC3 不支持 WebSocket / SSE
- 引入新依赖（Redis / WebSocket lib）会破坏 FC 部署兼容性
- Phase B T5 已用 SQL aggregate，无 Redis 缓存层

**方案**：**服务端事件驱动的 cache invalidation + 客户端 60s 智能轮询** —— 既兼容 FC，又把"事件发生后立即可见"的延迟从 60s 降到 < 5s。

## 1. In-scope / Out-of-scope

### In-scope
- **服务端**：
  - 派单 / view_log / reply / follow_log 的 create / update 路径上加 `DashboardCache.invalidate(hospitalId)`
  - 新增 1 个进程内 Map 缓存层 `DashboardCache`（in-memory, 不依赖 Redis）
  - 派单 / 跟进 / 回复 / 查看接口返回头加 `X-Dashboard-Cache-Invalidated: <hospital_id>`（可选，方便客户端判断）
- **客户端**：
  - `getHospitalUnviewedCount` / `getHospitalDashboardStats` / `getHospitalDashboardTrend` 三个接口加 `If-None-Match` header
  - 后端返回 `ETag: <hash>`，客户端 304 not modified 不重算
- **角色门禁**：仅 `ROLE_IDS.HOSPITAL_ACCOUNT` 受影响（其它角色走 crm dashboard 路径）
- **数据范围**：HOSPITAL scope 自动 WHERE hospital_id

### Out-of-scope
- C.3 业绩排行（多医院对比 + admin 视角；另立 spec）
- 跨实例 / 跨函数的 cache 共享（FC 实例之间不共享内存；如需共享需 Redis 引入，与 FC 不兼容）
- WebSocket / SSE（FC 限制）
- 客户端 push notification（需 service worker / 移动端原生）
- DashboardCache 持久化（in-memory 即可，FC cold start 后从空开始）

## 2. 关键约束

- 不引新 npm 依赖（不引 Redis / ioredis / ws）
- 不引新 native 模块
- 兼容 FC 部署（HTTP 函数，无长连接）
- 进程内 cache（`Map<number, { etag, data, timestamp }>`），重启清空
- invalidate 必须同步（invalidate 后下次读必然重算）
- 不动 Phase B 既有 route 的 operationId（避免 breaking change）
- 旧客户端（不带 If-None-Match）继续可用（无 etag 头 → 后端正常返回 200 + data）
- response shape 不变（仅在响应头加 ETag）
- 不动 crm_hospital / crm_dispatch 既有 schema

## 3. 服务端设计

### 3.1 DashboardCache 模块

新建 `apps/yishan-api/src/core/cache/dashboard-cache.ts`：

```ts
import { createHash } from 'node:crypto'

type CacheEntry = { etag: string; data: unknown; ts: number }

const store = new Map<string, CacheEntry>()
const TTL_MS = 30_000  // 30s 兜底

export const DashboardCache = {
  /**
   * 读缓存。返回 null = 缓存未命中或已过期；返回 entry.data + entry.etag = 命中。
   */
  get<T>(key: string): { data: T; etag: string } | null {
    const e = store.get(key)
    if (!e) return null
    if (Date.now() - e.ts > TTL_MS) {
      store.delete(key)
      return null
    }
    return { data: e.data as T, etag: e.etag }
  },

  /**
   * 写缓存。
   */
  set<T>(key: string, data: T): string {
    const etag = createHash('sha1').update(JSON.stringify(data)).digest('hex').slice(0, 16)
    store.set(key, { etag, data, ts: Date.now() })
    return etag
  },

  /**
   * 失效指定医院的 dashboard cache key。
   * 在派单 create / view_log insert / reply / follow_log create 路径调用。
   */
  invalidateHospital(hospitalId: number) {
    const prefix = `hospital:${hospitalId}:`
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key)
    }
  },

  /** 进程内全部清空（admin 重置用） */
  invalidateAll() {
    store.clear()
  },
}
```

### 3.2 三层缓存 key

```
hospital:${hospitalId}:stats       → /api/crm/v1/hospital/dashboard/stats 响应
hospital:${hospitalId}:trend       → /api/crm/v1/hospital/dashboard/trend 响应
hospital:${hospitalId}:unviewed    → /api/crm/v1/hospital/dispatches/unviewed-count 响应
```

### 3.3 3 个 route 加 cache

修改 `apps/yishan-api/src/modules/crm/routes/v1/hospital-dashboard/index.ts` 三个 route（GET /stats, /trend, /unviewed-count），加 If-None-Match / ETag 头：

```ts
route.get(
  '/hospital/dashboard/stats',
  { ... },
  async (req: any, reply: any) => {
    // 1) 取 hospitalId
    const hospitalId = await getCurrentHospitalId(req)  // 复用 T5 helper
    const cacheKey = `hospital:${hospitalId}:stats`

    // 2) 检查 If-None-Match
    const ifNoneMatch = req.headers['if-none-match']
    const cached = DashboardCache.get<unknown>(cacheKey)
    if (cached && ifNoneMatch === cached.etag) {
      reply.code(304)
      return null
    }

    // 3) 算数据
    const result = await HospitalDashboardService.getStats(uid(req), roleIds(req))

    // 4) 写缓存 + 发 ETag
    const etag = DashboardCache.set(cacheKey, result)
    reply.header('ETag', etag)
    return ResponseUtil.success(reply, result)
  },
)
```

> 类似改造 /trend 和 /unviewed-count。

### 3.4 4 个 invalidate 钩子

在以下路径调用 `DashboardCache.invalidateHospital(hospitalId)`：

| 触发动作 | Service 方法 | 文件 |
| --- | --- | --- |
| 派单创建（CRM 派单 / 会员派单） | `CustomersService.dispatch` / `MembersService.createDispatch` | `crm/services/customers.service.ts` / `crm/services/members.service.ts` |
| 派单回复 | `DispatchesService.addReply` | `crm/services/dispatches.service.ts` |
| 派单跟进 | `DispatchesService.addLog` | `crm/services/dispatches.service.ts` |
| 派单首次查看（auto recordView） | `DispatchesService.getById`（T3 嵌入的 recordView 路径） | `crm/services/dispatches.service.ts` |

每个路径在事务 commit 后调：
```ts
await DispatchesRepository.recordView(...).catch(() => {})  // 已有
DashboardCache.invalidateHospital(d.hospitalId)  // 新增
```

### 3.5 不动 schema

- **不动 Drizzle schema**（无新表）
- **不动 API response body shape**（完全兼容）
- **仅在 response header 加 `ETag`**

## 4. 客户端设计

### 4.1 改 3 个 wrapper 加 If-None-Match

`apps/yishan-admin/src/modules/crm/api/index.ts`：

```ts
const etagCache = new Map<string, string>()

export const getHospitalUnviewedCount = () => {
  const etag = etagCache.get('unviewed')
  return request<any>('/api/crm/v1/hospital/dispatches/unviewed-count', {
    headers: etag ? { 'If-None-Match': etag } : {},
  }).then((res: any) => {
    if (res?.headers?.etag) etagCache.set('unviewed', res.headers.etag)
    return res
  })
}
```

类似改造 getHospitalDashboardStats / getHospitalDashboardTrend。

### 4.2 fetch wrapper 处理 304

需要让 `request<any>` wrapper 透传 304 状态（默认 axios 把它当 error）。**关键决策**：用 fetch 替代 axios，或 axios adapter 处理 304。

**Ruling（按你偏好）**：选 **fetch 替代** —— 现代浏览器原生支持 + 无需 axios interceptor 改造。

```ts
// apps/yishan-admin/src/lib/fetch-api.ts（新建）
export async function fetchApi<T = any>(url: string, options: { headers?: Record<string, string> } = {}): Promise<{ data: T; etag?: string; notModified: boolean }> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (res.status === 304) {
    return { data: null as any, notModified: true }
  }
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  const etag = res.headers.get('etag') ?? undefined
  return { data, etag, notModified: false }
}
```

### 4.3 HospitalUnviewedBadge 升级

用 fetchApi 替代 request，并支持 304：

```tsx
const fetchUnviewed = useCallback(async () => {
  try {
    const etag = etagRef.current
    const res = await fetchApi('/api/crm/v1/hospital/dispatches/unviewed-count', {
      headers: etag ? { 'If-None-Match': etag } : {},
    })
    if (res.notModified) return
    if (res.etag) etagRef.current = res.etag
    setCount((res.data as any)?.data?.count ?? 0)
  } catch {}
}, [])
```

### 4.4 HospitalDashboard 同样升级

- 改 `useEffect` 用 fetchApi
- 304 命中时跳过 setState
- 失败降级同 Phase C.1

## 5. 验收

- 同一医院账号在 A 浏览器打开 dashboard，B 浏览器提交跟进 → A 浏览器 5s 内（下次轮询）看到新数据
- 同一医院账号 A 浏览器 2 个 tab，tab1 派单，tab2 dashboard → tab2 5s 内看到新派单
- 60s 内无任何事件时，请求是 304，response body 空（不浪费 JSON 序列化）
- 派单 / 跟进 / 回复 / 查看 4 个触发点全部能 invalidate
- 旧客户端（不带 If-None-Match）继续可用（无 etag → 200 + data）
- 进程重启后 cache 清空（行为正确）

## 6. Spec 自审

- **Placeholder 扫描**：无 TBD / TODO
- **内部一致性**：
  - 3 个 route 用同一 fetchApi pattern
  - 4 个 invalidate 钩子用同一 `DashboardCache.invalidateHospital(hospitalId)` 调用
  - ETag 生成用 SHA1(data) 16 chars
- **范围**：单 Phase C.2 计划可执行（1 新文件 + 3 route 改 + 4 invalidate + 1 fetchApi 客户端 + 1 client 升级），1 spec
- **歧义**：「invalidate 后下次读必然重算」= 同步从 Map.delete

## 7. 不在 C.2 内的 TODO

- **C.3 业绩排行**：需多医院对比 + admin 视角；另立 spec
- **跨 FC 实例 cache 共享**：需引入 Redis；与 FC 部署不兼容，**不做**
- **客户端 push notification**：需 service worker / 移动端原生；不属于 Web 看板场景

## 8. 风险与回退

- **风险 1**：Map cache 进程内，多 FC 实例各自独立。**回退**：把 invalid 改成 timestamp 兜底（旧客户端轮询到的 30s TTL 数据仍是旧的；只要 invalidate 频率够就 OK）
- **风险 2**：SHA1 ETag 碰撞概率极低（1/2^64），但理论存在。**回退**：用 SHA256 / xxhash
- **风险 3**：FC cold start 后 cache 空，30s 内所有医院都触发 200 重算。**回退**：可接受（30s 内是 cold start 阶段，QPS 极低）

---

**Spec 结束。** 等待 user review。
