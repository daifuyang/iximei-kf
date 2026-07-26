import { Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { successResponse } from "./common.js";

export const ApiTokenRecordSchema = Type.Object(
  {
    id: Type.Integer(),
    name: Type.String(),
    userId: Type.Integer(),
    expiresAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    lastUsedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    lastUsedIp: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { $id: "apiTokenRecord" },
);

// Preset duration values for API Token expiry. Mutually exclusive with expiresAt.
// If neither is provided, the route defaults to "30d".
export const ApiTokenDurationSchema = Type.Union(
  [
    Type.Literal("7d"),
    Type.Literal("30d"),
    Type.Literal("60d"),
    Type.Literal("90d"),
    Type.Literal("1y"),
    Type.Literal("never"),
  ],
  { $id: "apiTokenDuration" },
);

export const ApiTokenCreateReqSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 100 }),
    duration: Type.Optional(
      Type.String({
        $ref: "apiTokenDuration#",
        description:
          '预设过期时长。与 expiresAt 互斥。若都不传,默认为 "30d"。',
      }),
    ),
    expiresAt: Type.Optional(
      Type.String({
        format: "date-time",
        description: "自定义过期时间(ISO datetime)。与 duration 互斥。",
      }),
    ),
    scopes: Type.Optional(
      Type.Array(Type.String(), {
        deprecated: true,
        description:
          "【已废弃】scopes 参数不再接受。Token 权限继承所属用户当前 RBAC 角色。" +
          "传入非空数组将被拒绝（400 INVALID_PARAMETER）。",
      }),
    ),
  },
  { $id: "apiTokenCreateReq" },
);

const ApiTokenCreateDataSchema = Type.Object(
  {
    id: Type.Integer(),
    name: Type.String(),
    userId: Type.Integer(),
    expiresAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    createdAt: Type.String({ format: "date-time" }),
    // The one-time plaintext:
    token: Type.String(),
  },
  { $id: "apiTokenCreateData" },
);

const ApiTokenListDataSchema = Type.Object(
  {
    list: Type.Array(Type.Ref("apiTokenRecord")),
    total: Type.Integer(),
  },
  { $id: "apiTokenListData" },
);

export const ApiTokenDeleteDataSchema = Type.Object(
  {
    id: Type.Integer(),
  },
  { $id: "apiTokenDeleteData" },
);

export const ApiTokenCreateRespSchema = successResponse({
  data: Type.Ref("apiTokenCreateData"),
  $id: "apiTokenCreateResp",
});

export const ApiTokenRecordRespSchema = successResponse({
  data: Type.Ref("apiTokenRecord"),
  $id: "apiTokenRecordResp",
});

export const ApiTokenListRespSchema = successResponse({
  data: Type.Ref("apiTokenListData"),
  $id: "apiTokenListResp",
});

export const ApiTokenDeleteRespSchema = successResponse({
  data: Type.Ref("apiTokenDeleteData"),
  $id: "apiTokenDeleteResp",
});

export const registerApiToken = (fastify: FastifyInstance) => {
  fastify.addSchema(ApiTokenRecordSchema);
  fastify.addSchema(ApiTokenDurationSchema);
  fastify.addSchema(ApiTokenCreateReqSchema);
  fastify.addSchema(ApiTokenCreateDataSchema);
  fastify.addSchema(ApiTokenListDataSchema);
  fastify.addSchema(ApiTokenDeleteDataSchema);
  fastify.addSchema(ApiTokenCreateRespSchema);
  fastify.addSchema(ApiTokenRecordRespSchema);
  fastify.addSchema(ApiTokenListRespSchema);
  fastify.addSchema(ApiTokenDeleteRespSchema);
};

export default registerApiToken;