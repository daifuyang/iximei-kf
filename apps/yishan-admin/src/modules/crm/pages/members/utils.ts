/**
 * 会员顾客页 — 工具函数
 *
 * 把表单 payload 中的时间字段规整为后端 TypeBox schema 期望的格式：
 *   - `expectedDate` / `birthday` → `format: 'date'`   (YYYY-MM-DD)
 *   - `nextFollowUpAt`           → `format: 'date-time'` (ISO 字符串)
 *
 * ProFormDatePicker / ProFormDateTimePicker 默认返回 dayjs 实例，
 * 直接发到后端会被 schema 校验阶段拒为 400。
 *
 * 此外提供 `extractApiError` 把 umi-request 抛出的 Error
 * ("Request failed with status code 4xx") 转换成后端真实业务文案，
 * 避免运营只看到 status code 而看不到「该手机号已被使用」之类的提示。
 */

/* ──────── 时间归一化 ──────── */

const toDateOnly = (x: any) => {
  if (x === undefined || x === null || x === '') return x;
  // 把 dayjs / Date / ISO 字符串统一归一为 Date。
  // 取 UTC 日期分量而不是本地分量 —— 避免 'YYYY-MM-DDT22:00:00Z' 在 UTC+8 下
  // 落到次日，导致后端 schema 期望 2026-08-20 时收到 2026-08-21。
  let dt: Date | null = null;
  if (typeof x === 'string') {
    const parsed = new Date(x);
    dt = Number.isNaN(parsed.getTime()) ? null : parsed;
  } else if (x instanceof Date) {
    dt = Number.isNaN(x.getTime()) ? null : x;
  } else if (x && typeof x.toDate === 'function') {
    const d = x.toDate();
    dt = d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (dt) {
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return x;
};

const toIso = (x: any) => {
  if (x === undefined || x === null || x === '') return x;
  let d: Date | null = null;
  if (typeof x === 'string') {
    // 已经是 ISO 字符串就保持；纯 YYYY-MM-DD 也转 ISO（00:00:00Z）
    const parsed = new Date(x);
    d = Number.isNaN(parsed.getTime()) ? null : parsed;
  } else if (x instanceof Date) {
    d = Number.isNaN(x.getTime()) ? null : x;
  } else if (x && typeof x.toDate === 'function') {
    const dd = x.toDate();
    d = dd instanceof Date && !Number.isNaN(dd.getTime()) ? dd : null;
  }
  return d ? d.toISOString() : x;
};

export function normalizeMemberPayload<T extends Record<string, any>>(v: T): T {
  return {
    ...v,
    expectedDate: toDateOnly((v as any).expectedDate),
    birthday: toDateOnly((v as any).birthday),
    nextFollowUpAt: toIso((v as any).nextFollowUpAt),
  };
}

/* ──────── 错误文案提取 ──────── */

/**
 * 从 umi-request 抛出的错误中提取后端真实业务文案。
 *
 * 优先级：
 *   1. `e.response.data.message`  — 非 2xx 时 umi-request 把响应体放这里
 *   2. `e.data.message`           — 某些 wrapper 路径
 *   3. `e.message`，但跳过纯数字（"400"/"500"），避免被 status code 覆盖默认文案
 *   4. `null`，由调用方兜底「创建失败，请稍后再试」等中文提示
 */
export function extractApiError(e: any): string | null {
  if (!e) return null;
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.data?.message) return e.data.message;
  if (typeof e?.message === 'string' && /^\d+$/.test(e.message)) return null;
  return e?.message || null;
}