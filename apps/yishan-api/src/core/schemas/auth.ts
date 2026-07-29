/**
 * 认证相关的 TypeBox Schema 定义
 */

import { Static, Type } from "@sinclair/typebox";
import { successResponse } from "./common.js";
import { FastifyInstance } from "fastify";
import { passwordLoginTypeBoxProps } from "../utils/password-policy.js";

// 登录请求 Schema
const LoginReqSchema = Type.Object(
  {
    username: Type.String({
      description: "用户名或邮箱",
      minLength: 1,
      maxLength: 100
    }),
    // 登录只校验长度, 不强制复杂度(避免老 iximei 用户的弱密码被锁死)
    password: Type.String({
      description: "密码",
      ...passwordLoginTypeBoxProps,
    }),
    rememberMe: Type.Optional(
      Type.Boolean({
        description: "记住我",
        default: false
      })
    )
  },
  { $id: "loginReq" }
);

export type LoginReq = Static<typeof LoginReqSchema>;

// 登录响应数据 Schema - 优化为只返回认证信息
const LoginDataSchema = Type.Object(
  {
    token: Type.String({ description: "访问令牌" }),
    refreshToken: Type.Optional(
      Type.String({ description: "刷新令牌" })
    ),
    expiresIn: Type.Number({ description: "访问令牌过期时间（秒）" }),
    refreshTokenExpiresIn: Type.Optional(
      Type.Number({ description: "刷新令牌过期时间（秒）" })
    ),
    expiresAt: Type.Optional(
      Type.Number({ description: "访问令牌过期时间戳（秒）" })
    ),
    refreshTokenExpiresAt: Type.Optional(
      Type.Number({ description: "刷新令牌过期时间戳（秒）" })
    ),
    /**
     * 当前 hash 字段使用的算法格式。
     * 0 = 老 iximei（thinkcmf 5.x `###md5`）;1 = 新系统 scrypt v1。
     * 老用户首次登录成功后会被原子升级为 1。
     *
     * optional: 第三方客户端 mock 的 LoginData 仍可不带这两个字段。
     */
    passwordFormat: Type.Optional(Type.Number({ description: "密码 hash 算法格式, 0=老 iximei ###md5; 1=新系统 scrypt v1" })),
    /**
     * 后端是否建议当前用户改密。true = 前端应在头部展示 banner;
     * 改密成功后由 UserService.changePassword 清零。
     * 与 password_format 解耦,登录响应只在本次登录前后的值。
     */
    passwordChangeRecommended: Type.Optional(Type.Boolean({ description: "是否推荐改密, true=前端应展示 banner" })),
  },
  { $id: "loginData" }
);

export type LoginData = Static<typeof LoginDataSchema>;

// 登录响应 Schema
const LoginRespSchema = successResponse({
  data: Type.Ref("loginData"),
  $id: "loginResp",
});

export type LoginResp = Static<typeof LoginRespSchema>;

// 用户详细信息 Schema
const CurrentUserSchema = Type.Object(
  {
    id: Type.Number({ description: "用户ID" }),
    username: Type.String({ description: "用户名" }),
    email: Type.Optional(Type.String({ format: "email", description: "邮箱" })),
    phone: Type.Optional(Type.String({ description: "手机号" })),
    realName: Type.Optional(Type.String({ description: "真实姓名（医院账号从老 iximei 导入时可能为空）" })),
    avatar: Type.Optional(Type.String({ description: "头像URL" })),
    gender: Type.String({
      enum: ["0", "1", "2"],
      description: "性别（0-未知，1-男，2-女）"
    }),
    genderName: Type.String({ description: "性别名称" }),
    birthDate: Type.Optional(
      Type.String({
        format: "date",
        description: "出生日期"
      })
    ),
    status: Type.String({
      enum: ["0", "1", "2"],
      description: "状态（0-禁用，1-启用，2-锁定）"
    }),
    statusName: Type.String({ description: "状态名称" }),
    lastLoginTime: Type.Optional(
      Type.String({ format: "date-time", description: "最后登录时间" })
    ),
    lastLoginIp: Type.Optional(
      Type.String({ description: "最后登录IP" })
    ),
    loginCount: Type.Number({ description: "登录次数" }),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
    accessPath: Type.Optional(Type.Array(Type.String(), { description: "已授权菜单路径列表" })),
    /** 已绑定角色名称列表（如 super_admin / admin）。前端用于硬编码 dev-only 菜单的可见性判断。 */
    /**
     * 当前用户有效权限码集合（含 `__super_admin__` sentinel）。
     *
     * 路由处理器 `core/routes/api/v1/auth/index.ts:155` 会把这个字段塞进 result，
     * TypeBox schema 必须显式声明，fast-json-stringify 才会保留这个字段；
     * 否则前端 `currentUser.permissions.includes(...)` 永远 false，所有页面级
     * 权限判断（rename / create / delete / batch-assign 等按钮）全部失效。
     */
    permissions: Type.Optional(Type.Array(Type.String(), { description: "已绑定权限码集合（含 __super_admin__ sentinel）" })),
    passwordFormat: Type.Optional(Type.Number({ description: "密码 hash 算法格式, 0=老 iximei ###md5; 1=新系统 scrypt v1" })),
    passwordChangeRecommended: Type.Optional(Type.Boolean({ description: "是否推荐改密, true=前端应展示 banner" })),
  },
  { $id: "currentUser" }
);

export type CurrentUser = Static<typeof CurrentUserSchema>;

// 用户资料响应 Schema
const CurrentUserRespSchema = successResponse({
  data: Type.Ref("currentUser"),
  $id: "currentUserResp",
});

export type CurrentUserResp = Static<typeof CurrentUserRespSchema>;

// 刷新令牌请求 Schema
// refreshToken 设为可选：浏览器场景下从 HttpOnly cookie 读取，body 可为空；
// 非浏览器客户端仍可通过 body 传入。缺失时由路由处理器返回业务错误码。
const RefreshTokenReqSchema = Type.Object(
  {
    refreshToken: Type.Optional(
      Type.String({
        description: "刷新令牌（浏览器场景可省略，从 HttpOnly cookie 读取）",
        minLength: 1
      })
    )
  },
  { $id: "refreshTokenReq" }
);

export type RefreshTokenReq = Static<typeof RefreshTokenReqSchema>;

// 刷新令牌响应 Schema - 与登录响应相同
const RefreshTokenRespSchema = successResponse({
  data: Type.Ref("loginData"),
  $id: "refreshTokenResp",
});

export type RefreshTokenResp = Static<typeof RefreshTokenRespSchema>;

// 注册 Schema 到 Fastify 实例
const registerAuth = (fastify: FastifyInstance) => {
  fastify.addSchema(LoginReqSchema);
  fastify.addSchema(LoginDataSchema);
  fastify.addSchema(LoginRespSchema);
  fastify.addSchema(CurrentUserSchema);
  fastify.addSchema(CurrentUserRespSchema);
  fastify.addSchema(RefreshTokenReqSchema);
  fastify.addSchema(RefreshTokenRespSchema);
};

export default registerAuth;
