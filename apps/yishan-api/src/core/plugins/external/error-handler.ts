import fp from 'fastify-plugin'
import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { ResponseUtil } from '../../../utils/response.js'
import { BusinessError } from '../../../exceptions/business-error.js'
import { ValidationErrorCode } from '../../../constants/business-codes/validation.js'
import { AuthErrorCode } from '../../../constants/business-codes/auth.js'
import { ResourceErrorCode } from '../../../constants/business-codes/resource.js'
import { SystemErrorCode } from '../../../constants/business-codes/common.js'

/**
 * 判定 error 是否来自数据库层（MySQL / Drizzle）。
 *
 * 依据：MySQL 错误 code 以 `ER_` 开头（`ER_PARSE_ERROR`, `ER_NO_SUCH_TABLE` 等），
 * Drizzle 抛出的 DrizzleQueryError 也会透传上游 code。不再用 `error.message` 嗅探
 * 关键字（mysql / Drizzle），避免被业务数据里的字面量误命中。
 */
function isDatabaseError(error: any): boolean {
  const code = String(error?.code ?? '')
  if (code.startsWith('ER_')) return true
  if (code === 'ER_DUP_ENTRY') return true
  if (typeof error?.name === 'string' && /Drizzle.*Error/i.test(error.name)) return true
  return false
}

/**
 * 把 Fastify / Ajv 的英文校验错误翻成"字段名 + 中文业务文案"。
 *
 * 触发场景：路由 schema 校验失败 (HTTP 400, FST_ERR_VALIDATION)。
 * Fastify 5 把 Ajv 的诊断挂在 `error.validation: AjvError[]`,
 * 每条含 instancePath / keyword / params / message。
 *
 * 返回 null 表示这不是 schema 校验错误, 让调用方继续走原 message。
 */
type AjvError = {
  instancePath?: string
  message?: string
  keyword?: string
  params?: {
    pattern?: string
    limit?: number
    format?: string
    missingProperty?: string
    additionalProperty?: string
  }
}

// 用户密码复杂度规则: ^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]+$
// 识别方式: 字段名含 password / newPassword / accountPassword / oldPassword
// 且 keyword=pattern, 一律按密码规则给出专属文案。
// 不用正则去反匹配 schema 字符串, 避免 schema 微调后失配。
function isPasswordField(fieldName: string): boolean {
  return /(^|\.)(password|newPassword|oldPassword|accountPassword)$/i.test(fieldName)
}

function translateAjvItem(item: AjvError): string {
  // 字段名: body/password -> password
  const field = (item.instancePath || '').replace(/^\//, '').replace(/\//g, '.') || '参数'
  const kw = item.keyword
  const p = item.params || {}

  if (kw === 'required') {
    // required 时 instancePath 通常为空, 真实字段名挂在 params.missingProperty
    const target = p.missingProperty || field
    return `${target}:不能为空`
  }
  if (kw === 'minLength') {
    // 密码字段统一用"位"而不是"字符"
    return `${field}:长度不能少于 ${p.limit} 位`
  }
  if (kw === 'maxLength') {
    return `${field}:长度不能超过 ${p.limit} 位`
  }
  if (kw === 'minimum') {
    return `${field}:不能小于 ${p.limit}`
  }
  if (kw === 'maximum') {
    return `${field}:不能大于 ${p.limit}`
  }
  if (kw === 'format') {
    if (p.format === 'email') return `${field}:邮箱格式不正确`
    if (p.format === 'date') return `${field}:日期格式不正确 (应为 YYYY-MM-DD)`
    if (p.format === 'date-time') return `${field}:时间格式不正确`
    if (p.format === 'uri' || p.format === 'url') return `${field}:URL 格式不正确`
    return `${field}:${p.format} 格式不正确`
  }
  if (kw === 'pattern') {
    if (isPasswordField(field)) {
      return `${field}:必须包含字母和数字,只能使用字母、数字和 @$!%*?&`
    }
    return `${field}:格式不正确`
  }
  if (kw === 'enum') {
    return `${field}:取值不在允许范围内`
  }
  if (kw === 'additionalProperties') {
    return `${field}:不允许的额外字段 ${p.additionalProperty || ''}`.trim()
  }
  if (kw === 'type') {
    return `${field}:类型不正确`
  }
  // 兜底: 用 Ajv 自带 message, 但去掉 "must " 前缀让它更口语
  const raw = item.message || '格式不正确'
  return `${field}:${raw.replace(/^must\s+/i, '应').replace(/^must NOT\s+/i, '不能')}`
}

function friendlyValidationMessage(error: FastifyError): string | null {
  const validation = (error as any).validation as AjvError[] | undefined
  if (!Array.isArray(validation) || validation.length === 0) return null
  // 同字段多条错误合并到一行, 避免弹 4 行泡
  const lines = validation.map(translateAjvItem)
  return Array.from(new Set(lines)).join('；')
}

/**
 * 全局异常处理插件
 * 统一处理应用中的所有异常，避免在每个路由中重复异常处理逻辑
 *
 * Section 7：日志脱敏 — 不再把 request.body / Authorization 完整写入日志；
 * 字段级脱敏由 security plugin 提供。
 */
export default fp(async (fastify: FastifyInstance) => {
  // 设置全局错误处理器
  fastify.setErrorHandler(async (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // 记录错误日志（不输出 raw body / authorization）
    fastify.log.error({
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      params: request.params,
      query: request.query,
      requestId: (request as { requestId?: string }).requestId ?? request.id,
    }, 'Global error handler caught an error')

    // 如果响应已经发送，直接返回
    if (reply.sent) {
      return
    }

    const anyError = error as any
    const hasBusinessCode = typeof anyError?.code === 'number'

    if (error instanceof BusinessError || hasBusinessCode) {
      return ResponseUtil.error(reply, anyError.code, anyError.message, anyError.details)
    }

    // 处理 Fastify 内置错误
    if (error.statusCode) {
      const statusCode = error.statusCode
      // 优先把 schema 校验失败翻译成中文 + 字段名, 业务用户看得懂;
      // 翻译不出来再回落到 Fastify 自带的 message
      const message =
        friendlyValidationMessage(error) || error.message || "请求错误"

      // 根据HTTP状态码映射到对应的业务码
      let businessCode: number
      switch (statusCode) {
        case 400:
        case 422:
          businessCode = ValidationErrorCode.INVALID_PARAMETER
          break
        case 401:
          businessCode = AuthErrorCode.UNAUTHORIZED
          break
        case 403:
          businessCode = AuthErrorCode.FORBIDDEN
          break
        case 404:
          businessCode = ResourceErrorCode.NOT_FOUND
          break
        case 429:
          businessCode = ValidationErrorCode.TOO_MANY_REQUESTS
          break
        default:
          if (statusCode >= 400 && statusCode < 500) {
            businessCode = ValidationErrorCode.INVALID_PARAMETER
          } else {
            businessCode = SystemErrorCode.SYSTEM_ERROR
          }
      }

      return ResponseUtil.error(reply, businessCode, message)
    }

    // 处理数据库相关错误（按 code 前缀判定，不用 message 嗅探）
    if (isDatabaseError(error)) {
      return ResponseUtil.error(reply, SystemErrorCode.DATABASE_ERROR, "数据库操作失败")
    }

    // 处理网络相关错误
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return ResponseUtil.error(reply, SystemErrorCode.NETWORK_ERROR, "网络连接失败")
    }

    // 默认服务器内部错误
    return ResponseUtil.error(
      reply,
      SystemErrorCode.SYSTEM_ERROR,
      process.env.NODE_ENV === 'production' ? "服务器内部错误" : error.message
    )
  })
})
