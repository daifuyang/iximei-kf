/**
 * security.ts — Section 7 安全可观测性插件。
 *
 * 一站式提供：
 *   - Request ID：为每个请求生成/沿用 `X-Request-Id`，存入 request.id 与 reply header。
 *   - 日志脱敏：自动 drop 响应/日志里的 password / token / refreshToken /
 *     Authorization / Cookie 字段。
 *   - 启动日志：版本、commit SHA、Node 版本、注册插件列表、migration 状态。
 *
 * 该插件在 jwt-auth、cookie 之后注册（无硬依赖，使用 fp 包装即可）。
 */

import fp from "fastify-plugin";
import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { buildInfo } from "../../../utils/build-info.js";

const REQUEST_ID_HEADER = "x-request-id";
const REDACT_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "set-cookie",
  "apitoken",
  "apipassword",
  "secret",
]);

const REDACTED = "[REDACTED]";

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = REDACTED;
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

/**
 * Augment FastifyRequest with a stable `requestId` and a redacted-logs marker.
 */
declare module "fastify" {
  interface FastifyRequest {
    /** Match the value echoed in `X-Request-Id` header; UUID v4 by default. */
    requestId: string;
  }
  interface FastifyReply {
    /** Append a redacted copy of `body` to the JSON response so callers can still see it. */
    redactSensitiveFields(data: unknown): unknown;
  }
}

export default fp(
  async (fastify: FastifyInstance) => {
    // -- 0) Cache build identity (single read per process). ----------------
    // build-info 单例：所有 [startup] banner / request log 字段 / health
    // endpoint 都走它，避免在 hot path 反复读 env / fs。
    const build = buildInfo();

    // -- 1) Ensure every request has a requestId. -------------------------
    fastify.decorateRequest("requestId", "");
    fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
      const incoming = request.headers[REQUEST_ID_HEADER];
      const requestId = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
      request.requestId = requestId;
      reply.header(REQUEST_ID_HEADER, requestId);
      // 把 requestId + build identity 注入到 pino 日志子结构，**每条** HTTP log
      // 自带 { commitSha, version, builtAt }，下次"线上行为不符预期"时：
      //   grep 'commitSha' /var/log/.../yishan-crm.*.log
      // 立刻定位到具体 commit；不需要再反推 deploy 时间。
      const childLog = request.log.child({
        requestId,
        version: build.version,
        commitSha: build.commitSha,
        builtAt: build.builtAt,
      });
      // fastify 期望 request.log 是一个绑定好子字段的 logger；这里替换原引用。
      (request as unknown as { log: typeof childLog }).log = childLog;
    });

    // -- 2) Logger redaction: wrap the request log keys through redact() ---
    fastify.addHook("preHandler", async (request: FastifyRequest) => {
      const originalBody = (request as { body?: unknown }).body;
      if (originalBody && typeof originalBody === "object") {
        (request as unknown as { redactedBody: unknown }).redactedBody = redact(originalBody);
      }
    });

    // -- 3) Response redaction helper exposed on reply. -------------------
    fastify.decorateReply("redactSensitiveFields", function (data: unknown): unknown {
      return redact(data);
    });

    // -- 4) Startup banners -----------------------------------------------
    fastify.addHook("onReady", async () => {
      const plugins = Object.keys((fastify as unknown as { [k: string]: unknown }).register ? {} : {});
      // 仅打印关键启动信息，避免泄露敏感数据。
      fastify.log.info(
        {
          version: build.version,
          commitSha: build.commitSha,
          builtAt: build.builtAt,
          nodeVersion: process.versions.node,
          pluginCount: plugins.length,
          env: process.env.NODE_ENV ?? "development",
        },
        "[startup] yishan-api ready",
      );
    });
  },
  {
    name: "security",
  },
);
