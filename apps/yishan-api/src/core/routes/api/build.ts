/**
 * build.ts — 暴露 runtime 的 build 标识。
 *
 * 与 /api/health 不同：
 *   - /api/health 还要做一次 db SELECT 1；流量大时被 K8s readiness probe 狂 ping，
 *     会让 db probe 缓存的连接池被打进冷查询。
 *   - /api/build 是「纯内存」端点，无 I/O、无副作用、no-cache。
 *
 * 部署验证用法（fail-tracking 第一步）：
 *   curl https://crm.iximei.cn/api/build
 *   → 立刻显示 commitSha + version + builtAt
 *
 * 因 /api/* 是 autoload 挂载的路径前缀（见 core/app.ts 自动加载 core/routes/），
 * 这里用 route("") 让路径精确为 /api/build（与 health.ts 同谱）。
 *
 * 与 health.ts 的关系：build 字段来源相同（utils/build-info.ts），但 build endpoint
 * 永远 public、不需要 perm 校验、不需要 db。
 */

import type { FastifyPluginAsync } from "fastify";
import { buildInfo } from "../../../utils/build-info.js";
import { ResponseUtil } from "../../../utils/response.js";

const build: FastifyPluginAsync = async (fastify): Promise<void> => {
  // 用 plain `app.get`（不走 createRouteRegistrar）：build endpoint 完全公开，
  // 不挂 authenticate / requirePermission。任何人都能查，方便运维和应急排错。
  // 不暴露敏感数据（只 echo envvars 注入的标识），安全性可接受。
  fastify.get(
    "/build",
    {
      schema: {
        summary: "Build 标识（公开，仅读）",
        description:
          "返回当前进程实例的 build 标识：YISHAN_API_VERSION（monotonic 部署序号）、" +
          "GIT_COMMIT_SHA（12 字符 commit 短 SHA）、BUILD_TIME（UTC ISO8601 部署时刻）。" +
          "无 db query、无副作用、no-cache。部署验证用法：" +
          "  curl https://crm.iximei.cn/api/build",
        operationId: "getBuild",
        tags: ["system"],
        security: [],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              code: { type: "number" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  version: { type: "string" },
                  commitSha: { type: "string" },
                  builtAt: { type: "string" },
                  nodeVersion: { type: "string" },
                  uptimeSeconds: { type: "number" },
                  functionName: { type: "string" },
                },
              },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (_req, reply) => {
      const info = buildInfo();
      return ResponseUtil.success(reply, {
        version: info.version,
        commitSha: info.commitSha,
        builtAt: info.builtAt,
        nodeVersion: process.versions.node,
        uptimeSeconds: Math.round(process.uptime()),
        functionName: process.env.FUNCTION_NAME ?? "yishan-crm",
      });
    },
  );
};

export default build;
