/**
 * API Token Service
 *
 * 业务编排：duration/expiresAt 互斥校验、默认值回退、映射 DTO、
 * 抛业务异常。持久化全部走 ApiTokenRepository。
 *
 * API Token 定位为纯身份凭证，权限完全由用户当前 RBAC 角色实时计算。
 * 创建 Token 时不再接受或存储 scopes 字段。
 */

import { ApiTokenRepository } from "../repositories/api-token.repository.js";
import { ApiTokenMapper, type ApiTokenCreateResp, type ApiTokenRecordResp } from "../mappers/api-token.mapper.js";
import { AuthErrorCode } from "../../constants/business-codes/auth.js";
import { ValidationErrorCode } from "../../constants/business-codes/validation.js";
import { BusinessError } from "../../exceptions/business-error.js";

// ============================================================================
// Duration handling (moved from route)
// ============================================================================

export type ApiTokenDuration = "7d" | "30d" | "60d" | "90d" | "1y" | "never";

const DURATION_DAYS: Record<Exclude<ApiTokenDuration, "never">, number> = {
  "7d": 7,
  "30d": 30,
  "60d": 60,
  "90d": 90,
  "1y": 365,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Translate a preset duration string to an absolute Date, or null for "never". */
function durationToExpiresAt(duration: ApiTokenDuration): Date | null {
  if (duration === "never") return null;
  return new Date(Date.now() + DURATION_DAYS[duration] * DAY_MS);
}

// ============================================================================
// Service
// ============================================================================

export class ApiTokenService {
  /**
   * Create a new API token for the given user.
   * duration / expiresAt are mutually exclusive; if neither is given, defaults to "30d".
   * Token 权限不再由 scopes 控制 — 认证后继承用户当前 RBAC 角色权限。
   */
  static async createToken(
    userId: number,
    req: {
      name: string;
      duration?: ApiTokenDuration;
      expiresAt?: string;
    },
  ): Promise<ApiTokenCreateResp> {
    // Mutual exclusion: duration and expiresAt cannot be set together.
    if (req.duration && req.expiresAt) {
      throw new BusinessError(
        ValidationErrorCode.INVALID_PARAMETER,
        "duration 与 expiresAt 不能同时指定",
      );
    }

    let expiresAt: Date | null;
    if (req.duration) {
      expiresAt = durationToExpiresAt(req.duration);
    } else if (req.expiresAt) {
      const d = new Date(req.expiresAt);
      if (isNaN(d.getTime())) {
        throw new BusinessError(
          ValidationErrorCode.PARAMETER_FORMAT_ERROR,
          "expiresAt 格式无效",
        );
      }
      expiresAt = d;
    } else {
      // Default: 30 days.
      expiresAt = durationToExpiresAt("30d");
    }

    const result = await ApiTokenRepository.create({
      userId,
      name: req.name,
      expiresAt,
    });

    return ApiTokenMapper.toCreateResp(result);
  }

  /** List all non-deleted tokens owned by the given user. */
  static async listTokens(userId: number): Promise<{ list: ApiTokenRecordResp[]; total: number }> {
    const rows = await ApiTokenRepository.listByUser(userId);
    return {
      list: rows.map(ApiTokenMapper.toRecordResp),
      total: rows.length,
    };
  }

  /** Find a token by id, scoped to the owning user. Throws if not found. */
  static async getToken(userId: number, id: number): Promise<ApiTokenRecordResp> {
    const row = await ApiTokenRepository.findByIdForUser(id, userId);
    if (!row) {
      throw new BusinessError(AuthErrorCode.API_TOKEN_NOT_FOUND, "Token 不存在或已删除");
    }
    return ApiTokenMapper.toRecordResp(row);
  }

  /** Revoke a token owned by the given user. Throws if not found. */
  static async revokeToken(userId: number, id: number): Promise<{ id: number }> {
    const ok = await ApiTokenRepository.revoke(id, userId);
    if (!ok) {
      throw new BusinessError(AuthErrorCode.API_TOKEN_NOT_FOUND, "Token 不存在或已删除");
    }
    return { id };
  }
}