/**
 * ApiTokenService 单元测试
 *
 * 覆盖：
 *   - duration / expiresAt 互斥校验
 *   - 默认 30d 过期
 *   - Token 权限继承 RBAC（不再使用 scopes）
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiTokenService } from "../src/core/services/api-token.service.js";
import { ApiTokenRepository } from "../src/core/repositories/api-token.repository.js";
import { ValidationErrorCode } from "../src/constants/business-codes/validation.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ApiTokenService.createToken — duration / expiresAt 互斥", () => {
  it("duration + expiresAt 同时传 → 抛 INVALID_PARAMETER", async () => {
    await expect(
      ApiTokenService.createToken(1, {
        name: "bad",
        duration: "30d",
        expiresAt: "2027-01-01T00:00:00Z",
      }),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.INVALID_PARAMETER,
    });
  });

  it("expiresAt 格式非法 → 抛 PARAMETER_FORMAT_ERROR", async () => {
    await expect(
      ApiTokenService.createToken(1, {
        name: "bad-date",
        expiresAt: "not-a-date",
      }),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.PARAMETER_FORMAT_ERROR,
    });
  });

  it("duration='never' → expiresAt=null", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    await ApiTokenService.createToken(1, {
      name: "never",
      duration: "never",
    });

    const arg = spy.mock.calls[0][0];
    expect(arg.expiresAt).toBeNull();
  });

  it("默认（无 duration / expiresAt）→ 30d", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    await ApiTokenService.createToken(1, { name: "default" });

    const arg = spy.mock.calls[0][0];
    expect(arg.expiresAt).toBeInstanceOf(Date);
    const daysAhead =
      (arg.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysAhead).toBeGreaterThan(29.9);
    expect(daysAhead).toBeLessThan(30.1);
  });

  it("duration='7d' → ~7d", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    await ApiTokenService.createToken(1, {
      name: "week",
      duration: "7d",
    });

    const arg = spy.mock.calls[0][0];
    const daysAhead =
      (arg.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysAhead).toBeGreaterThan(6.9);
    expect(daysAhead).toBeLessThan(7.1);
  });

  it("createToken 不接受 scopes 参数（类型层面已移除）", async () => {
    // createToken 的 req 接口不再包含 scopes 字段。
    // 旧客户端发送 scopes 应由路由层拦截（见 me.api-tokens.routes.test.ts）。
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    await ApiTokenService.createToken(1, { name: "no-scopes" });

    const arg = spy.mock.calls[0][0];
    // 确保没有 scopes 字段被写入
    expect(arg).not.toHaveProperty("scopes");
  });
});
