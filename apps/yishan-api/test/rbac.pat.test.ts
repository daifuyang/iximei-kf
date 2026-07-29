/**
 * PAT RBAC 继承测试
 *
 * API Token 不再承载 scopes 权限裁剪。认证后权限完全由用户当前 RBAC 角色计算。
 * PAT 与 JWT 对同一用户的 effective permissions 必须一致。
 */

import { describe, expect, it } from "vitest";
import { PermissionService } from "../src/core/services/permission.service.js";

describe("PAT RBAC inheritance (no scope intersection)", () => {
  it("PermissionService.has respects 超级管理员 bypass", () => {
    // __超级管理员__ injection by PermissionService.loadForRoleIds is the
    // core RBAC bypass. Verify it still works.
    const perms = new Set(["__super_admin__"]);
    expect(PermissionService.has(perms, "any:code")).toBe(true);
  });

  it("PermissionService.has falls back to exact match when no bypass", () => {
    const perms = new Set(["system:user:list"]);
    expect(PermissionService.has(perms, "system:user:list")).toBe(true);
    expect(PermissionService.has(perms, "system:role:list")).toBe(false);
  });

  it("超级管理员 bypass sentinel is exported from permission-codes.ts", async () => {
    const { SUPER_ADMIN_BYPASS } = await import(
      "../src/constants/permission-codes.js"
    );
    expect(SUPER_ADMIN_BYPASS).toBe("__super_admin__");
  });

  it("ROLE_IDS includes SUPER_ADMIN", async () => {
    const { ROLE_IDS } = await import(
      "../src/constants/permission-codes.js"
    );
    expect(ROLE_IDS.SUPER_ADMIN).toBe(1);
  });
});
