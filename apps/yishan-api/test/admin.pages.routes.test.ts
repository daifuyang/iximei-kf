import Fastify from "fastify";
import { existsSync } from "node:fs";
import errorHandlerPlugin from "../src/core/plugins/external/error-handler.ts";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const portalPluginExists = existsSync("src/plugins/modules/portal");
const portalDescribe = portalPluginExists ? describe : describe.skip;

let adminPagesPlugin: any;
let registerCommonSchemas: any;
let registerPageSchemas: any;
let registerTemplateSchemas: any;
let PageService: any;
let PageErrorCode: any;
let BusinessError: any;

beforeAll(async () => {
  if (!portalPluginExists) return;

  const [
    adminPagesModule,
    commonSchemasModule,
    pageSchemasModule,
    templateSchemasModule,
    pageServiceModule,
    pageCodesModule,
    businessErrorModule,
  ] = await Promise.all([
    import("../src/plugins/modules/portal/routes/v1/admin/pages/index.ts"),
    import("../src/plugins/modules/portal/schemas/common.ts"),
    import("../src/plugins/modules/portal/schemas/page.ts"),
    import("../src/plugins/modules/portal/schemas/template.ts"),
    import("../src/plugins/modules/portal/services/page.service.ts"),
    import("../src/plugins/modules/portal/constants/business-codes/page.ts"),
    import("../src/plugins/modules/portal/exceptions/business-error.ts"),
  ]);

  adminPagesPlugin = adminPagesModule.default;
  registerCommonSchemas = commonSchemasModule.default;
  registerPageSchemas = pageSchemasModule.default;
  registerTemplateSchemas = templateSchemasModule.default;
  PageService = pageServiceModule.PageService;
  PageErrorCode = pageCodesModule.PageErrorCode;
  BusinessError = businessErrorModule.BusinessError;
});

async function buildApp() {
  const app = Fastify({ logger: false });
  app.decorate("authenticate", async (request: any) => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      const error = new Error("Unauthorized") as any;
      error.statusCode = 401;
      throw error;
    }
    request.currentUser = { id: 1, username: "admin" };
  });
  app.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/api/v1/admin/")) {
      return (app as any).authenticate(request, reply);
    }
  });
  await app.register(errorHandlerPlugin);
  registerCommonSchemas(app);
  registerPageSchemas(app);
  registerTemplateSchemas(app);
  await app.register(adminPagesPlugin, { prefix: "/api/v1/admin/pages" });
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

portalDescribe("Admin Pages routes", () => {
  it("GET /api/v1/admin/pages 返回分页列表", async () => {
    const app = await buildApp();
    const now = new Date().toISOString();
    const list = [{ id: 1, title: "关于我们", path: "/about", content: "页面内容", status: "1", createdAt: now, updatedAt: now }] as any;
    vi.spyOn(PageService, "getPageList").mockResolvedValue({ list, total: 1, page: 1, pageSize: 10 });
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/pages?page=1&pageSize=10", headers: { Authorization: "Bearer t" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    await app.close();
  });

  it("GET /api/v1/admin/pages 未授权返回401", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/pages?page=1&pageSize=10" });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    await app.close();
  });

  it("GET /api/v1/admin/pages/:id 成功获取详情", async () => {
    const app = await buildApp();
    const now = new Date().toISOString();
    const detail = { id: 3, title: "联系", path: "/contact", content: "页面内容", status: "1", createdAt: now, updatedAt: now } as any;
    vi.spyOn(PageService, "getPageById").mockResolvedValue(detail);
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/pages/3", headers: { Authorization: "Bearer t" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 3 });
    await app.close();
  });

  it("POST /api/v1/admin/pages 成功创建页面", async () => {
    const app = await buildApp();
    const now = new Date().toISOString();
    const created = { id: 11, title: "隐私政策", path: "/privacy", content: "页面内容", status: "1", createdAt: now, updatedAt: now } as any;
    vi.spyOn(PageService, "createPage").mockResolvedValue(created);
    const res = await app.inject({ method: "POST", url: "/api/v1/admin/pages", headers: { Authorization: "Bearer t" }, payload: { title: "隐私政策", path: "/privacy", content: "..." } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 11, path: "/privacy" });
    await app.close();
  });

  it("PUT /api/v1/admin/pages/:id 成功更新页面", async () => {
    const app = await buildApp();
    const now = new Date().toISOString();
    const updated = { id: 4, title: "关于我们", path: "/about", content: "页面内容", status: "1", createdAt: now, updatedAt: now } as any;
    vi.spyOn(PageService, "updatePage").mockResolvedValue(updated);
    const res = await app.inject({ method: "PUT", url: "/api/v1/admin/pages/4", headers: { Authorization: "Bearer t" }, payload: { title: "关于我们" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 4 });
    await app.close();
  });

  it("DELETE /api/v1/admin/pages/:id 成功删除页面", async () => {
    const app = await buildApp();
    vi.spyOn(PageService, "deletePage").mockResolvedValue({ id: 9 } as any);
    const res = await app.inject({ method: "DELETE", url: "/api/v1/admin/pages/9", headers: { Authorization: "Bearer t" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 9 });
    await app.close();
  });

  it("GET /api/v1/admin/pages/:id 不存在返回业务错误", async () => {
    const app = await buildApp();
    vi.spyOn(PageService, "getPageById").mockRejectedValue(new BusinessError(PageErrorCode.PAGE_NOT_FOUND, "页面不存在"));
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/pages/999", headers: { Authorization: "Bearer t" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(PageErrorCode.PAGE_NOT_FOUND);
    await app.close();
  });
});
