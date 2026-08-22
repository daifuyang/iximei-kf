/**
 * build-info.test.ts — getBuildInfo 行为锁定。
 *
 * 覆盖五种场景：
 *   1. workflow 注入三个 envvars → version / commitSha (12-char) / builtAt 全读出。
 *   2. 全部 envvars 缺失 → fallback 到 package.json + .git/HEAD + 'local-dev'。
 *   3. npm_package_version 单独注入（无 YISHAN_API_VERSION） → 取 npm_package_version。
 *   4. YISHAN_API_VERSION 优先于 npm_package_version。
 *   5. _cached 单例：第二次调用直接命中缓存，即便 envvars 变化也不重读。
 *
 * 单例 cache 的隔离靠 `vi.resetModules()` 让每次 import 都重新加载 build-info.ts
 * （重置模块级 _cached 变量）。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('utils/build-info — getBuildInfo', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('workflow 注入的 envvars 完整读出（commitSha 截断到 12 字符）', async () => {
    vi.resetModules();
    process.env.YISHAN_API_VERSION = '1.42.0';
    process.env.GIT_COMMIT_SHA = '8656b2dabcde1234567890abcdef1234567890ab';
    process.env.BUILD_TIME = '2026-08-22T01:23:45Z';

    const { getBuildInfo } = await import('../build-info.js');
    const info = getBuildInfo();
    expect(info.version).toBe('1.42.0');
    expect(info.commitSha).toBe('8656b2dabcde');
    expect(info.builtAt).toBe('2026-08-22T01:23:45Z');
  });

  it('所有 envvars 缺失时仍返回合法（fallback）', async () => {
    vi.resetModules();
    delete process.env.YISHAN_API_VERSION;
    delete process.env.GIT_COMMIT_SHA;
    delete process.env.BUILD_TIME;
    delete process.env.npm_package_version;

    const { getBuildInfo } = await import('../build-info.js');
    const info = getBuildInfo();
    expect(typeof info.version).toBe('string');
    expect(info.version.length).toBeGreaterThan(0);
    expect(typeof info.commitSha).toBe('string');
    expect(info.commitSha.length).toBeGreaterThan(0);
    expect(info.builtAt).toBe('local-dev');
  });

  it('npm_package_version 单独注入（无 YISHAN_API_VERSION）', async () => {
    vi.resetModules();
    delete process.env.YISHAN_API_VERSION;
    delete process.env.GIT_COMMIT_SHA;
    delete process.env.BUILD_TIME;
    process.env.npm_package_version = '2.0.0';

    const { getBuildInfo } = await import('../build-info.js');
    const info = getBuildInfo();
    expect(info.version).toBe('2.0.0');
  });

  it('YISHAN_API_VERSION 优先于 npm_package_version', async () => {
    vi.resetModules();
    process.env.YISHAN_API_VERSION = '1.99.0';
    process.env.npm_package_version = '1.0.0';
    delete process.env.GIT_COMMIT_SHA;
    delete process.env.BUILD_TIME;

    const { getBuildInfo } = await import('../build-info.js');
    const info = getBuildInfo();
    expect(info.version).toBe('1.99.0');
  });

  it('_cached 单例：模块加载后，envvars 变更不再重读', async () => {
    vi.resetModules();
    process.env.YISHAN_API_VERSION = '1.50.0';
    process.env.GIT_COMMIT_SHA = 'aaaabbbbccccdddd0000111122223333';
    process.env.BUILD_TIME = '2026-08-22T00:00:00Z';

    const m = await import('../build-info.js');
    const first = m.getBuildInfo();
    // change env; calling again on the same module instance should NOT pick up
    process.env.YISHAN_API_VERSION = '9.99.0';
    process.env.GIT_COMMIT_SHA = 'ffffffffffff';
    process.env.BUILD_TIME = '2099-01-01T00:00:00Z';
    const second = m.getBuildInfo();
    expect(second).toEqual(first); // cached
    expect(second.version).toBe('1.50.0');
  });
});
