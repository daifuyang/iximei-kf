import { MySqlDateTime } from 'drizzle-orm/mysql-core'
import { dateUtils } from '@/utils/date.js'

/**
 * Drizzle's mysql2 driver typeCasts DATETIME to a naive 'YYYY-MM-DD HH:mm:ss'
 * string, then MySqlDateTime.mapFromDriverValue appends Z. That treats China
 * wall-clock values as UTC, so FC (and any UTC runtime) shows times 8 hours
 * ahead. Writes used toISOString() and stored UTC wall-clock into DATETIME.
 *
 * Patch both directions to Asia/Shanghai. Import this module before queries.
 */
MySqlDateTime.prototype.mapFromDriverValue = function mapFromDriverValue(value: string): Date {
  return dateUtils.parseMysqlDateTime(value)
}

MySqlDateTime.prototype.mapToDriverValue = function mapToDriverValue(value: Date): string {
  return dateUtils.formatShanghaiDateTime(value)
}
