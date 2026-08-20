# Phase C.2 通知增强（图标提醒 + 邮件推送）设计

> 日期：2026-07-28
> 范围：用户原话 6 项已 100% 落地；本 spec 收尾 Phase C 移交项
> 部署约束：阿里云函数计算（FC3）**不支持 WebSocket / SSE / 长连接**；邮件推送用 SMTP 短请求兼容
> 依赖：Phase A + B + C.1 全部已落地
> 不在本 spec：C.3 业绩排行（另立 spec）

## 0. 业务目标

医院账号现在能登录后台看派单，但「**有事件发生时能感知**」的能力弱：
- Phase B T10 落了菜单 Badge 60s 轮询（unviewed count）—— 但**用户必须打开菜单**才看到
- 没有「小红点 + 邮件 + 标题前缀 + 浏览器原生 notification」组合

C.2 目标：**在用户在场和离屏时都能感知派单事件**，无需引入 WebSocket / Redis，兼容 FC 部署。

## 1. In-scope / Out-of-scope

### In-scope

**A. 图标提醒增强**（客户端，纯前端）
- **A.1** 浏览器 `document.title` 动态前缀计数：`🔔 (3) 本院数据看板 - iximei-kf`
- **A.2** 浏览器原生 `Notification` API（在用户首次进 dashboard 时询问权限；批准后系统级推送）
- **A.3** 浏览器 tab 切换 `visibilitychange` 时拉取最新数据（`unviewed count` 立即更新，不等 60s 轮询）
- **A.4** 点击菜单 Badge 跳转时**清零 count**（用户主动「看了」则 badge 减到 0；后端 view_log 已有 source of truth）
- **A.5** Badge 支持 99+ 截断 + 数字动画（增加一位数 / 减少一位数 smooth transition）

**B. 邮件推送**（后端 + 简单前端订阅）
- **B.1** 新增 1 个 `crm_notification` 表（crm_ 前缀）存用户的邮件通知偏好 + 历史
- **B.2** 新增 SMTP 配置（用 `nodemailer`，最稳的 Node 邮件库）
- **B.3** 4 个事件钩子触发邮件：派单 create / 派单 reply / 派单 follow / 派单 view（医院账号首次查看）
- **B.4** 邮件模板（4 个，HTML + 纯文本双格式）
- **B.5** 用户偏好设置 UI：哪些事件要邮件 / 免打扰时段 / 退订（个人 token 链接）
- **B.6** 邮件发送走**异步队列**（不阻塞 HTTP 响应）：Fastify reply → 推入内存队列 → setImmediate / setInterval 批量发送

### Out-of-scope
- C.3 业绩排行（另立 spec）
- 短信推送（需第三方短信网关 + 实名认证 + 计费）
- 移动端 push notification（需 iOS/Android 原生 SDK）
- 邮件附件 / 富文本编辑器
- 邮件 A/B testing / 打开率追踪
- 跨 FC 实例的邮件队列共享（不引 Redis）

## 2. 关键约束

- **兼容 FC 部署**：所有路径必须是短连接（HTTP 调用在 30s 内完成；邮件发送走异步）
- **不引 WebSocket / SSE / socket.io**
- SMTP 用 `nodemailer`（行业标准，纯 JS，~270KB 体积）
- 邮件队列用 in-memory 数组 + `setImmediate`（不引 BullMQ / ioredis）
- 失败重试：单封邮件最多重试 3 次，间隔 1s / 5s / 30s（指数退避）
- 邮件发送失败**不阻塞业务**（try/catch + 日志）
- 退订：每封邮件底部带 `?token=...&unsub=1` 链接，点击后写库标记 `unsubscribed_at`
- 时区：邮件时间戳用 Asia/Shanghai（与既有 dashboard 一致）
- 不动 Phase A/B/C.1 既有数据 / schema
- Drizzle schema 新增 `crm_notification` + `crm_notification_event` 2 表

## 3. 数据模型

### 3.1 新表 `crm_notification`

```ts
// apps/yishan-api/src/modules/crm/db/schema.ts 追加
export const crmNotification = mysqlTable('crm_notification', {
  id: int().primaryKey().autoincrement().notNull(),
  userId: int('user_id').notNull(),  // 收通知的人（医院账号）
  eventType: varchar('event_type', { length: 50 }).notNull(),
  // 'dispatch_created' | 'dispatch_replied' | 'dispatch_followed' | 'dispatch_viewed'
  enabled: int().notNull().default(1),  // 0/1
  channel: varchar('channel', { length: 20 }).notNull().default('email'),
  // 'email' (本 phase) | 'browser' (前端 Notification API)
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}, (t) => [
  uniqueIndex('uniq_crm_notification_user_event_channel')
    .on(t.userId, t.eventType, t.channel),
  index('idx_crm_notification_user').on(t.userId),
])
```

### 3.2 新表 `crm_notification_event`

```ts
export const crmNotificationEvent = mysqlTable('crm_notification_event', {
  id: int().primaryKey().autoincrement().notNull(),
  userId: int('user_id').notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  channel: varchar('channel', { length: 20 }).notNull(),
  payload: json('payload').notNull(),  // 邮件模板所需字段（dispatchId, customerName, hospitalName, ...）
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // 'pending' | 'sent' | 'failed' | 'unsubscribed'
  attempts: int().notNull().default(0),
  lastError: text('last_error'),
  unsubscribedAt: datetime('unsubscribed_at', { mode: 'date' }),
  sentAt: datetime('sent_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}, (t) => [
  index('idx_crm_notification_event_user').on(t.userId),
  index('idx_crm_notification_event_status_created').on(t.status, t.createdAt),
])
```

### 3.3 迁移

按 C.1 T1 同样的手工裁剪流程：
```bash
cd apps/yishan-api/src/modules/crm
npx drizzle-kit generate --config=./drizzle.config.ts
# 手工裁剪 SQL 只留 crm_notification + crm_notification_event
```

## 4. 后端

### 4.1 新模块 `apps/yishan-api/src/modules/crm/notification/`

```
notification/
├── config.ts          # SMTP 配置 + 邮件模板
├── mailer.ts           # nodemailer transporter + send()
├── queue.ts            # 内存队列 + 重试
├── service.ts          # 高层 API: enqueue, getPreferences, setPreferences
├── events.ts           # 4 个事件 hook: dispatchCreated / dispatchReplied / ...
├── unsubscribe.ts      # 退订路由 + token 校验
├── schema.ts           # request/response TypeBox
├── routes.ts           # Fastify 路由: GET/PUT /preferences, GET /unsubscribe
└── tests/
    ├── mailer.test.ts
    ├── queue.test.ts
    ├── service.test.ts
```

### 4.2 SMTP 配置

```ts
// notification/config.ts
export const SMTP_CONFIG = {
  host: process.env.SMTP_HOST ?? 'smtp.example.com',
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: process.env.SMTP_SECURE !== 'false',  // 默认 SSL
  auth: {
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },
  from: process.env.SMTP_FROM ?? 'noreply@iximei.com',
}
```

环境变量（写 `.env` 或 FC 函数配置）：
```
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_USER=noreply@iximei.com
SMTP_PASS=...
SMTP_FROM="iximei-kf <noreply@iximei.com>"
```

### 4.3 Mailer

```ts
// notification/mailer.ts
import nodemailer from 'nodemailer'
import { SMTP_CONFIG } from './config.js'
import { renderTemplate } from './templates.js'

let transporter: nodemailer.Transporter | null = null

export function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(SMTP_CONFIG)
  }
  return transporter
}

export async function sendMail(args: {
  to: string
  subject: string
  html: string
  text: string
  unsubscribeToken?: string
}) {
  // 退订链接
  const unsubUrl = args.unsubscribeToken
    ? `${process.env.PUBLIC_URL}/api/crm/v1/notification/unsubscribe?token=${args.unsubscribeToken}`
    : null
  const html = args.html.replace('{{UNSUB_URL}}', unsubUrl ?? '#')
  return getTransporter().sendMail({
    from: SMTP_CONFIG.from,
    to: args.to,
    subject: args.subject,
    html,
    text: args.text,
  })
}
```

### 4.4 Queue（异步发送）

```ts
// notification/queue.ts
import { sendMail } from './mailer.js'
import { crmNotificationEvent } from '../db/schema.js'
import { drizzleDb } from '@/db'
import { eq } from 'drizzle-orm'

const queue: Array<{ id: number }> = []
let processing = false
const RETRY_DELAYS = [1000, 5000, 30_000]  // 1s / 5s / 30s

export async function enqueue(eventId: number) {
  queue.push({ id: eventId })
  if (!processing) {
    processQueue()
  }
}

async function processQueue() {
  processing = true
  while (queue.length > 0) {
    const { id } = queue.shift()!
    await processOne(id).catch(() => {})
  }
  processing = false
}

async function processOne(eventId: number) {
  // 读 event、查 user email、render template、send、update status
  // 失败：attempts++，attempts < 3 → 重新入队 + 重试延迟
}
```

### 4.5 4 个事件钩子

```ts
// notification/events.ts
import { dispatchCreated, dispatchReplied, dispatchFollowed, dispatchViewed } from './handlers.js'

export function registerNotificationHooks() {
  // 在 dispatches.service.ts / customers.service.ts / members.service.ts 关键路径
  // 调用：await dispatchCreated(dispatchId)
}

// 4 个 handler 大致相同：query dispatch → 收件人（医院账号 email）→ render template → enqueue
```

### 4.6 用户偏好 API

```ts
// notification/routes.ts
route.get(
  '/notification/preferences',
  { access: { permission: PERMS.NOTIFICATION_VIEW } },  // 新权限
  async (req, reply) => {
    const result = await NotificationService.getPreferences(uid(req))
    return ResponseUtil.success(reply, result)
  },
)

route.put(
  '/notification/preferences',
  { access: { permission: PERMS.NOTIFICATION_UPDATE } },
  async (req, reply) => {
    const result = await NotificationService.setPreferences(uid(req), req.body)
    return ResponseUtil.success(reply, result)
  },
)

route.get(
  '/notification/unsubscribe',
  // 不需权限，用 token 验证
  async (req, reply) => {
    await NotificationService.unsubscribe(req.query.token)
    return reply.type('text/html').send('<h1>已退订</h1>')
  },
)
```

### 4.7 4 个新权限

```ts
// apps/yishan-api/src/modules/crm/permissions.ts 追加
NOTIFICATION_VIEW: { code: 'crm:notification:view', label: 'CRM-通知-查看偏好', group: 'crm' },
NOTIFICATION_UPDATE: { code: 'crm:notification:update', label: 'CRM-通知-修改偏好', group: 'crm' },
// dispatch_created / _replied / _followed / _viewed 邮件推送不需单独权限码（用户偏好开启即发）
```

## 5. 客户端

### 5.1 图标提醒增强（`HospitalUnviewedBadge` 升级）

```tsx
// apps/yishan-admin/src/components/HospitalUnviewedBadge/index.tsx
// 增强：document.title 前缀 + tab 切回立即 fetch + Notification API
import { useEffect, useRef, useState } from 'react'

const ORIGIN_TITLE = document.title  // 模块加载时记下原始标题

function DocumentTitle({ count }: { count: number }) {
  useEffect(() => {
    document.title = count > 0
      ? `(🔔 ${count}) ${ORIGIN_TITLE}`
      : ORIGIN_TITLE
    return () => { document.title = ORIGIN_TITLE }
  }, [count])
  return null
}

function NotificationRequest({ onApprove }: { onApprove: () => void }) {
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') onApprove()
      })
    }
  }, [])
  return null
}

function BrowserNotify({ count, lastCount }: { count: number; lastCount: number }) {
  useEffect(() => {
    if (count > lastCount && Notification.permission === 'granted') {
      new Notification('iximei-kf 新派单', {
        body: `本院有 ${count} 个新派单未查看`,
        icon: '/logo.png',
        tag: 'crm-unviewed',
      })
    }
  }, [count])
  return null
}

function VisibilityRefresh({ fetcher }: { fetcher: () => void }) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') fetcher()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [fetcher])
  return null
}
```

### 5.2 邮件偏好设置 UI

`apps/yishan-admin/src/modules/crm/pages/notification-preferences/index.tsx`：

```tsx
<PageContainer header={{ title: '通知偏好' }}>
  <ProTable
    rowKey="eventType"
    dataSource={preferences}
    columns={[
      { title: '事件类型', dataIndex: 'eventType' },
      { title: '邮件', dataIndex: 'enabled',
        render: (v, r) => <Switch checked={v === 1} onChange={(c) => update(r.eventType, c)} /> },
    ]}
  />
</PageContainer>
```

### 5.3 API wrappers

```ts
// apps/yishan-admin/src/modules/crm/api/index.ts 追加
export const getNotificationPreferences = () =>
  request<any>('/api/crm/v1/notification/preferences')
export const updateNotificationPreference = (eventType: string, enabled: boolean) =>
  request<any>('/api/crm/v1/notification/preferences', {
    method: 'PUT',
    data: { eventType, enabled },
  })
```

## 6. 文件清单

| 文件 | 类型 | Task |
| --- | --- | --- |
| `apps/yishan-api/src/modules/crm/db/schema.ts` | 修改 | T1 |
| `apps/yishan-api/src/modules/crm/drizzle/0003_*.sql` | 新增 | T1 |
| `apps/yishan-api/src/modules/crm/notification/config.ts` | 新增 | T2 |
| `apps/yishan-api/src/modules/crm/notification/mailer.ts` | 新增 | T2 |
| `apps/yishan-api/src/modules/crm/notification/queue.ts` | 新增 | T2 |
| `apps/yishan-api/src/modules/crm/notification/service.ts` | 新增 | T3 |
| `apps/yishan-api/src/modules/crm/notification/events.ts` | 新增 | T3 |
| `apps/yishan-api/src/modules/crm/notification/templates.ts` | 新增 | T3 |
| `apps/yishan-api/src/modules/crm/notification/routes.ts` | 新增 | T4 |
| `apps/yishan-api/src/modules/crm/notification/unsubscribe.ts` | 新增 | T4 |
| `apps/yishan-api/src/modules/crm/notification/tests/*.ts` | 新增 | T5 |
| `apps/yishan-api/src/modules/crm/permissions.ts` | 修改 | T4 |
| `apps/yishan-admin/src/components/HospitalUnviewedBadge/index.tsx` | 修改 | T6 |
| `apps/yishan-admin/src/modules/crm/pages/notification-preferences/index.tsx` | 新增 | T7 |
| `apps/yishan-admin/src/modules/crm/api/index.ts` | 修改 | T7 |
| `docs/superpowers/handoffs/2026-07-28-phase-c2.md` | 新增 | T8 |

## 7. 验收

- **图标提醒 A**：
  - 医院账号进 dashboard 触发 `Notification.requestPermission()`，批准后有新派单时浏览器右下角弹系统通知
  - tab 标题前缀 `🔔 (3) 本院数据看板`
  - 切到其它 tab 再切回，badge 立即更新
  - 点击 badge 跳到派单列表后 badge 减 0
- **邮件推送 B**：
  - 派单 create 后医院账号邮箱收到「您有新派单：XX 客户」
  - 邮件底部有退订链接，点击后写 `unsubscribed_at`，再发同事件不再寄
  - 在偏好设置页关掉「派单创建」事件后，create 时不再寄
  - SMTP 失败：3 次重试后状态 `failed`，业务不报错

## 8. Spec 自审

- **Placeholder 扫描**：无 TBD
- **内部一致性**：
  - 4 个 handler 走同一 NotificationService.enqueue
  - 4 个事件类型 = 4 个 handler = 4 个模板
  - 邮件退订 token = 用户 ID + HMAC 防伪
- **范围**：1 spec / 1 plan / 8 task，Phase C.2 闭环
- **歧义**：「FC 兼容」= 所有调用在 30s HTTP 超时内完成

## 9. 不在 C.2 内的 TODO

- **C.3 业绩排行**：另立 spec
- **跨 FC 实例邮件队列**：不引 Redis；接受 cold start 丢失
- **邮件 A/B testing**：不在 v1 范围

## 10. 风险与回退

- **风险 1**：nodemailer 装包 + SMTP 凭据 = 部署复杂度 +1
  - **回退**：环境变量可空，空则邮件钩子不挂载
- **风险 2**：FC cold start 邮件队列丢失
  - **回退**：in-memory 队列可接受（FC 函数实例寿命 = 单次调用，但 queue 是 process 内的；下次冷启动从 0 开始）
- **风险 3**：SMTP 服务商限速
  - **回退**：队列自带 3 次重试 + 指数退避

---

**Spec 结束。** 等待 user review。
