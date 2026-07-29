/**
 * 锁住 PASSWORD_POLICY 的关键不变量。
 *
 * 目的: 防止后续"好心人"在某个 schema 里又手写 minLength/pattern,
 * 导致 system 6 位 / crm 8 位的分叉再次出现。
 */

import { describe, expect, it } from 'vitest'
import {
  PASSWORD_POLICY,
  passwordLoginTypeBoxProps,
  passwordTypeBoxProps,
  validatePasswordByPolicy,
} from '../utils/password-policy.js'

describe('PASSWORD_POLICY 不变量', () => {
  it('minLength ≤ maxLength', () => {
    expect(PASSWORD_POLICY.minLength).toBeLessThanOrEqual(PASSWORD_POLICY.maxLength)
  })

  it('minLength ≥ 6 (NIST 推荐下限)', () => {
    expect(PASSWORD_POLICY.minLength).toBeGreaterThanOrEqual(6)
  })

  it('pattern 必须要求至少一个字母', () => {
    expect(PASSWORD_POLICY.pattern.test('abcdef')).toBe(false) // 全字母也必须含数字
    expect(PASSWORD_POLICY.pattern.test('abc123')).toBe(true)
  })

  it('pattern 必须要求至少一个数字', () => {
    expect(PASSWORD_POLICY.pattern.test('123456')).toBe(false) // 全数字必须含字母
    expect(PASSWORD_POLICY.pattern.test('abc123')).toBe(true)
  })

  it('pattern 必须限制字符集为 [a-zA-Z\\d@$!%*?&]', () => {
    expect(PASSWORD_POLICY.pattern.test('abc123#')).toBe(false) // # 不允许
    expect(PASSWORD_POLICY.pattern.test('abc123!')).toBe(true)
    expect(PASSWORD_POLICY.pattern.test('abc 123')).toBe(false) // 空格不允许
  })

  it('pattern 与 patternString 等价 (改 RegExp 时要同步改 string)', () => {
    // 这是最常踩的坑: RegExp 改了忘改 string, 导致 schema 层和 service 层规则不一致
    // 用一个合规密码验证两边都通过, 不合规密码两边都拒绝
    expect(PASSWORD_POLICY.pattern.test('ab1234')).toBe(true)
    const reFromString = new RegExp(PASSWORD_POLICY.patternString)
    expect(reFromString.test('ab1234')).toBe(true)
    expect(PASSWORD_POLICY.pattern.test('123456')).toBe(false)
    expect(reFromString.test('123456')).toBe(false)
  })
})

describe('passwordTypeBoxProps (schema 层使用)', () => {
  it('必须包含 minLength/maxLength/pattern 三件套', () => {
    expect(passwordTypeBoxProps).toHaveProperty('minLength')
    expect(passwordTypeBoxProps).toHaveProperty('maxLength')
    expect(passwordTypeBoxProps).toHaveProperty('pattern')
  })

  it('字段值必须与 PASSWORD_POLICY 一致 (避免硬编码分叉)', () => {
    expect(passwordTypeBoxProps.minLength).toBe(PASSWORD_POLICY.minLength)
    expect(passwordTypeBoxProps.maxLength).toBe(PASSWORD_POLICY.maxLength)
    expect(passwordTypeBoxProps.pattern).toBe(PASSWORD_POLICY.patternString)
  })
})

describe('passwordLoginTypeBoxProps (登录场景, 仅长度)', () => {
  it('登录 schema 不带 pattern (兼容老 iximei 用户的弱密码)', () => {
    expect(passwordLoginTypeBoxProps).not.toHaveProperty('pattern')
  })

  it('登录 schema 长度约束与 policy 一致', () => {
    expect(passwordLoginTypeBoxProps.minLength).toBe(PASSWORD_POLICY.minLength)
    expect(passwordLoginTypeBoxProps.maxLength).toBe(PASSWORD_POLICY.maxLength)
  })
})

describe('validatePasswordByPolicy (service 层兜底)', () => {
  it('合规密码返回 null', () => {
    expect(validatePasswordByPolicy('ab1234')).toBeNull()
    expect(validatePasswordByPolicy('Abcd1234')).toBeNull()
    expect(validatePasswordByPolicy('1234abc')).toBeNull()
  })

  it('非字符串/空 返回 minLength 提示', () => {
    expect(validatePasswordByPolicy('')).toBe(PASSWORD_POLICY.message.minLength(PASSWORD_POLICY.minLength))
    // @ts-expect-error 故意测非法类型
    expect(validatePasswordByPolicy(null)).toBeTruthy()
  })

  it('过短返回 minLength 提示', () => {
    const msg = validatePasswordByPolicy('ab')
    expect(msg).toBe(PASSWORD_POLICY.message.minLength(PASSWORD_POLICY.minLength))
  })

  it('过长返回 maxLength 提示', () => {
    const msg = validatePasswordByPolicy('a'.repeat(PASSWORD_POLICY.maxLength + 1))
    expect(msg).toBe(PASSWORD_POLICY.message.maxLength(PASSWORD_POLICY.maxLength))
  })

  it('缺字母返回 complexity 提示', () => {
    expect(validatePasswordByPolicy('123456')).toBe(PASSWORD_POLICY.message.complexity)
  })

  it('缺数字返回 complexity 提示', () => {
    expect(validatePasswordByPolicy('abcdef')).toBe(PASSWORD_POLICY.message.complexity)
  })

  it('含不允许字符返回 complexity 提示', () => {
    expect(validatePasswordByPolicy('abc123#')).toBe(PASSWORD_POLICY.message.complexity)
    expect(validatePasswordByPolicy('abc 123')).toBe(PASSWORD_POLICY.message.complexity)
  })
})