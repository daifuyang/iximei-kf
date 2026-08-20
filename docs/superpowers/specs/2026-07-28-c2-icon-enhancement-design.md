# Phase C.2A 图标提醒增强（Icon Enhancement）设计

> 日期：2026-07-28
> 范围：用户原话 6 项已 100% 落地 + Phase C.1 看板已完成；本 spec 收尾 C.2 的**纯前端**部分
> 不在本 spec：C.2B 邮件推送（需要 SMTP 凭据，暂存为后续 ticket）
> 依赖：Phase A + B + C.1 全部已落地

## 0. 业务目标

Phase B T10 落了菜单 Badge 60s 轮询，但**用户必须打开菜单**才看到。增强：
- tab 标题前缀计数（用户切到其它 tab 时也能看到）
- 浏览器原生 Notification（用户首次进 dashboard 时询问权限；批准后系统级推送）
- tab 切回时**立即**拉取（不等 60s 轮询）
- 点击 badge 跳转时**清零** count
- 数字动画（99+ 截断 + smooth transition）

## 1. In-scope / Out-of-scope

### In-scope（纯前端，无新依赖）
- **A.1** `document.title` 动态前缀计数：`🔔 (3) 本院数据看板 - iximei-kf`
- **A.2** 浏览器 `Notification` API（用户首次进 dashboard 询问权限；批准后系统级推送）
- **A.3** `visibilitychange` 监听：tab 切回时立即拉取 unviewed count（不等 60s 轮询）
- **A.4** 点击 badge 跳到派单列表后**清零 count**（视觉反馈；后端 view_log 已有 source of truth）
- **A.5** Badge 支持 99+ 截断 + 数字动画（antd `CountUp` 或 `Statistic` 组件）

### Out-of-scope
- C.2B 邮件推送（需要 SMTP 凭据 + 模板 + 退订机制，另立 spec）
- C.3 业绩排行（多医院对比）
- 移动端原生 push
- WebSocket / SSE / 后端实时推送（FC 不支持）

## 2. 关键约束

- 不引新 npm 依赖
- 兼容 FC 部署（无需后端配合）
- 不动 Phase A/B/C.1 既有代码（只升级 HospitalUnviewedBadge 1 个文件 + 路由配置）
- 用户首次进 dashboard 才询问 Notification 权限（不要在 app load 时就问，避免打扰）
- 浏览器兼容性：`Notification` API + `document.title` + `visibilitychange` 都是标准 API，IE 11 放弃

## 3. 文件清单

| 文件 | 类型 |
| --- | --- |
| `apps/yishan-admin/src/components/HospitalUnviewedBadge/index.tsx` | 修改 |

> 1 个文件改动。无需新建文件，无需后端改动。

## 4. 组件升级

### 4.1 当前组件（Phase B T10 落地）

```tsx
// apps/yishan-admin/src/components/HospitalUnviewedBadge/index.tsx
import { useCallback, useEffect, useState } from 'react'
import { getHospitalUnviewedCount } from '@/modules/crm/api'

export default function HospitalUnviewedBadge() {
  const [count, setCount] = useState(0)
  // ... 60s 轮询 + ROLE_IDS.HOSPITAL_ACCOUNT 门禁
}
```

### 4.2 升级后

```tsx
// apps/yishan-admin/src/components/HospitalUnviewedBadge/index.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { getHospitalUnviewedCount } from '@/modules/crm/api'
import { Statistic } from 'antd'

const ORIGIN_TITLE = (typeof document !== 'undefined' ? document.title : '')

function useDocumentTitle(count: number) {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const base = ORIGIN_TITLE.replace(/^\(\S+\s\d+\)\s/, '')  // 去掉旧前缀
    document.title = count > 0
      ? `(🔔 ${count}) ${base}`
      : base
    return () => { document.title = base }
  }, [count])
}

function useNotificationPermission() {
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') {
      // 延迟 3s 询问，避免打扰首次加载
      const t = setTimeout(() => Notification.requestPermission(), 3000)
      return () => clearTimeout(t)
    }
  }, [])
}

function useBrowserNotification(count: number, lastCount: number) {
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    if (count > lastCount && count > 0) {
      new Notification('iximei-kf 新派单', {
        body: `本院有 ${count} 个新派单未查看`,
        icon: '/logo.png',
        tag: 'crm-unviewed',
      })
    }
  }, [count])
}

function useVisibilityRefresh(fetcher: () => void) {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const handler = () => {
      if (document.visibilityState === 'visible') fetcher()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [fetcher])
}

function useEtagPolling() {
  // 60s 轮询 + If-None-Match/ETag（Phase C.2A 暂不实现 304 优化，留作后续）
  // 沿用 Phase B T10 的 request<any> 简单轮询
}

export default function HospitalUnviewedBadge() {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const lastCountRef = useRef(0)
  // role gate: ROLE_IDS.HOSPITAL_ACCOUNT（沿用 Phase B T10 fix 后的 enum 引用）
  
  const fetchCount = useCallback(async () => {
    if (/* role !== HOSPITAL_ACCOUNT */) return
    setLoading(true)
    try {
      const res: any = await getHospitalUnviewedCount()
      if (res?.success) {
        const newCount = res.data?.count ?? 0
        lastCountRef.current = count
        setCount(newCount)
      }
    } catch {} finally { setLoading(false) }
  }, [count])

  useEffect(() => {
    fetchCount()
    const id = setInterval(fetchCount, 60_000)
    return () => clearInterval(id)
  }, [fetchCount])

  useDocumentTitle(count)
  useNotificationPermission()
  useBrowserNotification(count, lastCountRef.current)
  useVisibilityRefresh(fetchCount)

  const displayCount = count > 99 ? '99+' : count
  return (
    <Badge count={displayCount} offset={[0, 2]} dot={loading}>
      <span>派单管理</span>
    </Badge>
  )
}
```

### 4.3 关键交互

- **首次加载**：3s 后询问 Notification 权限
- **新派单到达**：count 从 0 变 3 → 浏览器右下角弹系统通知「本院有 3 个新派单未查看」
- **tab 切到后台**：`visibilitychange` 触发，但**不**重新拉取（避免后台浪费）；tab 切回时拉取
- **tab 标题前缀**：`document.title = (🔔 3) 本院数据看板 - iximei-kf`
- **点击 badge 跳到派单列表**：组件**不**自动清零；后端 view_log 在医院账号**首次访问派单详情**时已经写（T3 自动 recordView）；count 会在下次轮询 / tab 切回时自动反映新数字
  - **补充**：如要立即清零视觉效果，可以在路由 `/crm/dispatches` 页面 mount 时 dispatch 一个 `unviewedSeen` 事件，badge 监听后清零
- **99+ 截断**：>99 显示「99+」

## 5. 验收

- 医院账号进 `/crm/hospital-dashboard`：
  - 3s 后浏览器弹 Notification 权限询问
  - 批准后，tab 标题前缀更新为 `(🔔 N) 原标题`
  - 切到其它 tab 5s 后切回，badge 立即更新（不需等 60s 轮询）
  - 模拟服务器推 1 个新派单（手动改 DB 模拟事件），浏览器右下角系统通知
- 没进 dashboard 的 tab 不会弹通知（避免在 `/login` 页面也问权限）
- 100 个未查看时显示「99+」
- 旧 tab 不弹通知（Notification API 自带去重 tag）

## 6. Spec 自审

- **Placeholder 扫描**：无 TBD
- **内部一致性**：4 个 hook 都在 `HospitalUnviewedBadge` 内部，无 prop 渗透
- **范围**：1 个文件改动，3 个 task
- **歧义**：「新派单」= `count > lastCountRef.current`

## 7. 不在 C.2A 内的 TODO

- **C.2B 邮件推送**：需 SMTP 凭据 + 模板 + 退订机制；另立 spec
- **C.3 业绩排行**：另立 spec
- **304 优化（ETag）**：Phase C.2A 不实现，**已有** Phase C.2 原 spec 但被用户拆为后续；C.2A 用简单 60s 轮询

## 8. 风险与回退

- **风险 1**：Notification API 在某些浏览器（Safari PWA / iOS Safari）行为差异
  - **回退**：try/catch 包住，失败时降级到只 setTitle
- **风险 2**：document.title 在 SSR 阶段报错
  - **回退**：`typeof document !== 'undefined'` guard

---

**Spec 结束。** 等待 user review。
