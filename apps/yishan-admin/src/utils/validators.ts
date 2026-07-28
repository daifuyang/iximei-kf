/**
 * 与 apps/yishan-api/src/modules/crm/_validation.ts 共享正则字面量；
 * 修改其中一处时请同步另一处。后续可以抽到 packages/shared。
 */

/** 大陆手机号：以 1 开头，第二位 3-9，共 11 位 */
export const PHONE_RE = /^1[3-9]\d{9}$/

/** QQ：5–15 位数字，首位非 0 */
export const QQ_RE = /^[1-9]\d{4,14}$/

/** 微信：6–50 位字母/数字/下划线/减号；以字母开头 */
export const WECHAT_RE = /^[a-zA-Z][a-zA-Z0-9_-]{5,49}$/

/** 客户姓名：1–50 字（按 UTF-16 code unit 计，与 TypeBox 一致） */
export const nameRules = [
  { required: true, whitespace: true, message: '请输入客户姓名' },
  { max: 50, message: '客户姓名最长 50 字' },
] as const

/** 手机号：可选，提供时必须合法 */
export const mobileRules = [
  { pattern: PHONE_RE, message: '请输入正确的手机号' },
] as const

/** QQ：5–15 位数字 */
export const qqRules = [
  { pattern: QQ_RE, message: '请输入正确的 QQ 号' },
] as const

/** 微信：6–50 位字母/数字/下划线/减号 */
export const wechatRules = [
  { pattern: WECHAT_RE, message: '6–50 位字母/数字/下划线/减号，且以字母开头' },
] as const
