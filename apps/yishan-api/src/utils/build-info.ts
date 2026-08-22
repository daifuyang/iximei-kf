/**
 * build-info.ts — 单一来源读 runtime 的 build 标识。
 *
 * 三个字段都是有意义的，绝不静默打到 unknown：
 *   - version     优先取 fastify.server.opts.version（dev 模式 fastify-cli 自动注入），
 *                 再取 YISHAN_API_VERSION（workflow 注入，1.<run_number>.0），
 *                 再 fallback 到本地 package.json 读出（dev CLI）。
 *   - commitSha   优先取 GIT_COMMIT_SHA（workflow 注入 12 字符短 SHA），
 *                 fallback 到 .git/HEAD 本地读，最后 'unknown'。
 *   - builtAt     BUILD_TIME（workflow 注入 ISO8601 UTC），dev fallback 'local-dev'。
 *
 * 调用方：
 *   - /api/health response 把这仨字段透出。
 *   - security.ts 的 [startup] banner 同理。
 *   - security.ts 的 request.log 自动 attach：每次 HTTP log 都带 v/c/b，下一次
 *     "线上跟想象不一样" 时，第一步 grep log 就知道是哪个 commit。
 *
 * 设计原则：fail loud。如果 build 走不到上述路径，至少产物行为仍是 unknown + local-dev，
 * 不会假报一个看起来对的版本号。所有路径都不引入子进程 / IO 抖动（PKG 路径以外）。
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** 静态单例：首次访问时从 process.env / .git 读出，后续都缓存。 */
let _cached: { version: string; commitSha: string; builtAt: string } | undefined;

function readVersionFromPackageJson(): string {
  try {
    // dist/... → dist/../package.json
    const pkgPath = join(__dirname, '..', 'package.json');
    if (existsSync(pkgPath)) {
      const raw = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: unknown };
      if (typeof raw.version === 'string' && raw.version.length > 0) return raw.version;
    }
  } catch {
    /* ignore */
  }
  return '0.0.0';
}

function readCommitShaFromGitDir(): string {
  try {
    const head = join(process.cwd(), '.git', 'HEAD');
    if (existsSync(head)) {
      const ref = readFileSync(head, 'utf8').trim();
      if (ref.startsWith('ref:')) {
        const refPath = join(process.cwd(), '.git', ref.slice(5));
        if (existsSync(refPath)) {
          return readFileSync(refPath, 'utf8').trim().slice(0, 12);
        }
      }
      // detached HEAD — ref 字段直接是 SHA
      return ref.slice(0, 12);
    }
  } catch {
    /* not a git checkout (FC function code has no .git) */
  }
  return 'unknown';
}

export interface BuildInfo {
  /** YISHAN_API_VERSION / package.json#version。dev CLI 一般能取到；FC 运行时取 workflow 注入值。 */
  readonly version: string;
  /** 12 字符的 commit 短 SHA。FC 运行时取 workflow 注入值；dev fallback 到 .git/HEAD。 */
  readonly commitSha: string;
  /** UTC ISO8601 部署时刻。FC 运行时取 workflow 注入值；dev fallback 'local-dev'。 */
  readonly builtAt: string;
}

export function getBuildInfo(): BuildInfo {
  if (_cached) return _cached;
  const version =
    process.env.YISHAN_API_VERSION ||
    (process.env.npm_package_version ?? readVersionFromPackageJson());
  const commitSha =
    process.env.GIT_COMMIT_SHA?.slice(0, 12) || readCommitShaFromGitDir();
  const builtAt = process.env.BUILD_TIME || 'local-dev';
  _cached = { version, commitSha, builtAt };
  return _cached;
}

/** 给日志用的扁平对象：`{ version, commitSha, builtAt }` —— 直接 `log.info({ ...buildInfo(), ... })`。 */
export function buildInfo(): BuildInfo {
  return getBuildInfo();
}
