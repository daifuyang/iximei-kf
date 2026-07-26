import { createRouteRegistrar } from '../../../../route-registrar.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../../utils/response.js";
import { ApiTokenService } from "../../../../../services/api-token.service.js";
import { registerPermissions, type PermissionRef } from '../../../../../permissions/catalog.js';
import { BusinessError } from "../../../../../../exceptions/business-error.js";
import { ValidationErrorCode } from "../../../../../../constants/business-codes/validation.js";

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  MANAGE: { code: 'system:api-token:manage', label: 'API Token-管理', group: 'system' },
});
registerPermissions(...Object.values(PERMS));

/**
 * /api/v1/me/api-tokens
 *
 * 仅做参数提取 + Service 调用 + ResponseUtil 封装。
 * duration/expiresAt 互斥校验、默认值回退、记录映射、错误码转换等均下沉到 ApiTokenService。
 */
const apiTokens: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  // POST /api/v1/me/api-tokens
  route.post(
    "/",
    {
      access: { permission: PERMS.MANAGE },
      // Section 7：PAT 创建限流（默认 10/min）。authenticate 与 requirePermission 由 route-registrar 装配。
      preHandler: [
        fastify.rateLimit("patCreate"),
      ],
      schema: {
        summary: "创建 API Token",
        description:
          "为当前用户创建一个新的 API Token。明文 token 仅在创建时返回一次。过期时间可通过 duration 预设或 expiresAt 自定义(互斥),都不传默认为 30d。",
        operationId: "meCreateApiToken",
        tags: ["me-api-tokens"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "apiTokenCreateReq#" },
        response: { 200: { $ref: "apiTokenCreateResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.currentUser.id;
      const body = request.body as {
        name: string;
        duration?: "7d" | "30d" | "60d" | "90d" | "1y" | "never";
        expiresAt?: string;
        scopes?: string[];
      };

      // 拒绝旧客户端携带 scopes 的请求
      if (body.scopes && body.scopes.length > 0) {
        throw new BusinessError(
          ValidationErrorCode.INVALID_PARAMETER,
          "scopes 已废弃，Token 权限继承所属用户当前 RBAC 角色。请移除 scopes 参数后重试。",
        );
      }

      const data = await ApiTokenService.createToken(userId, {
        name: body.name,
        duration: body.duration,
        expiresAt: body.expiresAt,
      });

      return ResponseUtil.success(reply, data, "API Token 创建成功,请妥善保存明文 token");
    },
  );

  // GET /api/v1/me/api-tokens
  route.get(
    "/",
    {
      access: { permission: PERMS.MANAGE },
      schema: {
        summary: "我的 API Token 列表",
        operationId: "meListApiTokens",
        tags: ["me-api-tokens"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "apiTokenListResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.currentUser.id;
      const { list, total } = await ApiTokenService.listTokens(userId);
      return ResponseUtil.success(reply, { list, total }, "获取成功");
    },
  );

  // GET /api/v1/me/api-tokens/:id
  route.get(
    "/:id",
    {
      access: { permission: PERMS.MANAGE },
      schema: {
        summary: "获取单个 API Token",
        operationId: "meGetApiToken",
        tags: ["me-api-tokens"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "apiTokenRecordResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.currentUser.id;
      const id = (request.params as { id: number }).id;
      const data = await ApiTokenService.getToken(userId, id);
      return ResponseUtil.success(reply, data, "获取成功");
    },
  );

  // DELETE /api/v1/me/api-tokens/:id
  route.delete(
    "/:id",
    {
      access: { permission: PERMS.MANAGE },
      schema: {
        summary: "撤销 API Token",
        operationId: "meRevokeApiToken",
        tags: ["me-api-tokens"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "apiTokenDeleteResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.currentUser.id;
      const id = (request.params as { id: number }).id;
      const data = await ApiTokenService.revokeToken(userId, id);
      return ResponseUtil.success(reply, data, "Token 已撤销");
    },
  );

};

export default apiTokens;