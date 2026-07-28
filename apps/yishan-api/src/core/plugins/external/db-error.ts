/**
 * MySQL errno → 业务码翻译。
 *
 * 解决问题：service 调 repository 时，Drizzle / mysql2 抛出的 raw `Failed query: ...` 会
 * 漏到前端，且 statusCode=500 + `code: SystemErrorCode.DATABASE_ERROR` 对用户没语义。
 *
 * 用法：
 *   return withDbErrorMapping(() => CustomersRepository.create(input))
 *
 * 行为：
 *   - 1062 + 唯一键名 number_id → 客户编号已存在（21004）
 *   - 1406 → 字段长度超过限制（21006）
 *   - 1366 → 字段值类型不匹配（21004）
 *   - 其它 errno 原样抛出，由 error-handler.ts 兜底
 *
 * 与 error-handler.ts 的关系：
 *   - error-handler.ts 是"未翻译的兜底"（database 错误统一返回 SystemErrorCode.DATABASE_ERROR）；
 *   - 本文件是"已被 service 识别的精准翻译"，必须在 service 显式调用 withDbErrorMapping 才生效。
 */
import { BusinessError } from '../../../exceptions/business-error.js'
import { ValidationErrorCode } from '../../../constants/business-codes/validation.js'
import { ResourceErrorCode } from '../../../constants/business-codes/resource.js'

/** MySQL 重复键 */
export const ER_DUP_ENTRY = 1062
/** 数据过长（超过列宽） */
export const ER_DATA_TOO_LONG = 1406
/** 字段值类型不匹配 */
export const ER_TRUNCATED_WRONG_VALUE = 1366

/**
 * 把 mysql2 / Drizzle 抛出的 error 翻译成业务码。
 * 业务码会经过 error-handler.ts 的 BusinessError 分支直接返回给前端。
 *
 * Drizzle 在 0.44+ 会把 driver 错误包成 `new DrizzleQueryError(...)`，原始的
 * mysql2 错误（带 errno / sqlMessage）放在 `error.cause` 上。兼容两种形态。
 */
export function translateDbError(err: unknown): never {
  // Drizzle wraps driver errors; look at err.cause first, then err itself.
  const e: any = err
  const c: any = e?.cause
  const target = (c && (typeof c.errno === 'number' || typeof c.code === 'string')) ? c : e
  if (!target || typeof target.errno !== 'number') throw err
  if (target.errno === ER_DUP_ENTRY) {
    const sql = String(target.sqlMessage ?? '')
    if (sql.includes('number_id') || sql.includes('uniq_crm_customer_number_id')) {
      throw new BusinessError(
        ValidationErrorCode.PARAMETER_FORMAT_ERROR,
        '客户编号已存在',
      )
    }
    throw new BusinessError(
      ResourceErrorCode.ALREADY_EXISTS,
      '数据已存在重复',
    )
  }
  if (target.errno === ER_DATA_TOO_LONG) {
    throw new BusinessError(
      ValidationErrorCode.PARAMETER_LENGTH_ERROR,
      '字段长度超过数据库限制',
    )
  }
  if (target.errno === ER_TRUNCATED_WRONG_VALUE) {
    throw new BusinessError(
      ValidationErrorCode.PARAMETER_FORMAT_ERROR,
      '字段值格式不正确',
    )
  }
  throw err
}

/**
 * 包装一个数据库调用；抛出 errno 时由 translateDbError 翻译成业务码。
 * 其它 error 原样抛出。
 */
export async function withDbErrorMapping<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    return translateDbError(err) as never
  }
}
