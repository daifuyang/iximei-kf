/**
 * 共享 db-error 翻译器单元测试。
 *
 * 覆盖：1062 number_id 唯一键、1406 数据过长、1366 类型不匹配、
 *       其它 errno 透传、空输入。
 */
import { describe, expect, it } from 'vitest'
import {
  translateDbError,
  withDbErrorMapping,
  ER_DUP_ENTRY,
  ER_DATA_TOO_LONG,
  ER_TRUNCATED_WRONG_VALUE,
} from '../src/core/plugins/external/db-error.js'
import { BusinessError } from '../src/exceptions/business-error.js'
import { ValidationErrorCode } from '../src/constants/business-codes/validation.js'
import { ResourceErrorCode } from '../src/constants/business-codes/resource.js'

function makeError(errno: number, sqlMessage = '') {
  const e: any = new Error(`ER_${errno}: ${sqlMessage}`)
  e.errno = errno
  e.sqlMessage = sqlMessage
  return e
}

describe('translateDbError', () => {
  it('1062 + number_id 唯一键 → 客户编号已存在 (PARAMETER_FORMAT_ERROR)', () => {
    try {
      translateDbError(makeError(ER_DUP_ENTRY, "Duplicate entry 'VIP000000999999' for key 'crm_customer.uniq_crm_customer_number_id'"))
      throw new Error('expected to throw')
    } catch (e: any) {
      expect(e).toBeInstanceOf(BusinessError)
      expect(e.code).toBe(ValidationErrorCode.PARAMETER_FORMAT_ERROR)
      expect(e.message).toBe('客户编号已存在')
    }
  })

  it('1062 其它唯一键 → ALREADY_EXISTS', () => {
    try {
      translateDbError(makeError(ER_DUP_ENTRY, "Duplicate entry 'foo' for key 'bar'"))
      throw new Error('expected to throw')
    } catch (e: any) {
      expect(e).toBeInstanceOf(BusinessError)
      expect(e.code).toBe(ResourceErrorCode.ALREADY_EXISTS)
      expect(e.message).toBe('数据已存在重复')
    }
  })

  it('1406 数据过长 → 字段长度超过限制 (PARAMETER_LENGTH_ERROR)', () => {
    try {
      translateDbError(makeError(ER_DATA_TOO_LONG, "Data too long for column 'qq'"))
      throw new Error('expected to throw')
    } catch (e: any) {
      expect(e).toBeInstanceOf(BusinessError)
      expect(e.code).toBe(ValidationErrorCode.PARAMETER_LENGTH_ERROR)
      expect(e.message).toBe('字段长度超过数据库限制')
    }
  })

  it('1366 类型不匹配 → 字段值格式不正确 (PARAMETER_FORMAT_ERROR)', () => {
    try {
      translateDbError(makeError(ER_TRUNCATED_WRONG_VALUE, "Incorrect integer value"))
      throw new Error('expected to throw')
    } catch (e: any) {
      expect(e).toBeInstanceOf(BusinessError)
      expect(e.code).toBe(ValidationErrorCode.PARAMETER_FORMAT_ERROR)
      expect(e.message).toBe('字段值格式不正确')
    }
  })

  it('其它 errno 原样透传', () => {
    const err = makeError(1146, "Table doesn't exist")
    expect(() => translateDbError(err)).toThrow(err)
  })

  it('非 errno error 原样透传', () => {
    const err = new Error('some random error')
    expect(() => translateDbError(err)).toThrow(err)
  })

  it('Drizzle 包装的 error（errno 在 cause 上）也能翻译', () => {
    const cause: any = new Error("Data too long for column 'qq' at row 1")
    cause.errno = ER_DATA_TOO_LONG
    cause.sqlMessage = "Data too long for column 'qq' at row 1"
    const wrapped: any = new Error('Failed query: insert into crm_customer ...')
    wrapped.cause = cause
    try {
      translateDbError(wrapped)
      throw new Error('expected to throw')
    } catch (e: any) {
      expect(e).toBeInstanceOf(BusinessError)
      expect(e.code).toBe(ValidationErrorCode.PARAMETER_LENGTH_ERROR)
      expect(e.message).toBe('字段长度超过数据库限制')
    }
  })

  it('Drizzle 包装的 1062 + number_id 也能翻译', () => {
    const cause: any = new Error("Duplicate entry 'X' for key 'crm_customer.uniq_crm_customer_number_id'")
    cause.errno = ER_DUP_ENTRY
    cause.sqlMessage = cause.message
    const wrapped: any = new Error('Failed query')
    wrapped.cause = cause
    try {
      translateDbError(wrapped)
      throw new Error('expected to throw')
    } catch (e: any) {
      expect(e).toBeInstanceOf(BusinessError)
      expect(e.code).toBe(ValidationErrorCode.PARAMETER_FORMAT_ERROR)
      expect(e.message).toBe('客户编号已存在')
    }
  })

  it('null/undefined 输入原样透传', () => {
    expect(() => translateDbError(null)).toThrow()
    expect(() => translateDbError(undefined)).toThrow()
  })
})

describe('withDbErrorMapping', () => {
  it('正常 resolve 时返回原值', async () => {
    const result = await withDbErrorMapping(async () => 42)
    expect(result).toBe(42)
  })

  it('1062 触发后翻译成 BusinessError', async () => {
    await expect(
      withDbErrorMapping(async () => {
        throw makeError(ER_DUP_ENTRY, "Duplicate entry 'x' for key 'crm_customer.uniq_crm_customer_number_id'")
      }),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.PARAMETER_FORMAT_ERROR,
      message: '客户编号已存在',
    })
  })

  it('非 errno error 原样抛出', async () => {
    const err = new Error('boom')
    await expect(withDbErrorMapping(async () => { throw err })).rejects.toBe(err)
  })
})
