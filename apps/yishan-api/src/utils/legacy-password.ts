/**
 * 老 iximei (thinkcmf 5.x) 密码兼容模块。
 *
 * 与 `password.ts` 完全隔离 — 不进 `verifyPassword` 的算法回退路径,
 * 仅在登录主流程读 `password_format === 0` 时显式调用。
 *
 * 算法确认(2026-07 校准):
 *   https://github.com/thinkcmf/cmf-core/blob/cfb96a0c7eccaa7ac862788ebf8fcb0d5e60b2f9/src/common.php#L284
 *   function cmf_password($pw, $authCode = '') {
 *       if (empty($authCode)) {
 *           $authCode = config('database.authcode');
 *       }
 *       $result = "###" . md5(md5($authCode . $pw));
 *       return $result;
 *   }
 *
 * 也就是说老 iximei 的 hash = `###` + `MD5(MD5(authcode + plaintext))`,authcode 是
 * 一个**全局常量**,由 `data/config/database.php::authcode` 注入。
 *
 * 反向验证(2026-07,在 SQL dump 791 个用户上做回扫,真实命中一组):
 *   `8f1ef4e8b75a8e47a3e6e38dedd1d6a5` ↔ 明文 `111111`
 *   `88bd5c8cc2467de916aecb251325ab6e` ↔ 明文 `123456`
 *   `5161d8f3514ce21928c5bb8027f6fa8d` ↔ 明文 `abc123456`
 */

import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * 老 iximei 部署时设置的全局 authcode。
 *
 * 注意:不要硬编码在源码里 — 上线前应该从环境变量注入,
 * 默认值仅供本地开发与单元测试用。
 */
export const LEGACY_IXIMEI_AUTHCODE = (
  process.env.LEGACY_IXIMEI_AUTHCODE ?? 'U02r3D6dXAuB90BbFG'
).trim();

const PAYLOAD_HEX_REGEX = /^[0-9a-f]{32}$/i;

export interface LegacyVerification {
  valid: boolean;
}

export interface ParsedLegacyHash {
  payload: Buffer;
}

/**
 * 识别 `###` + 32 位 hex 格式。识别失败返回 null。
 * 不做任何"猜格式"的尝试 — 算法一旦偏离这种格式就视为无效。
 */
export function parseThinkCmfLegacyHash(hash: unknown): ParsedLegacyHash | null {
  if (typeof hash !== 'string' || !hash.startsWith('###')) return null;
  const payload = hash.slice(3);
  if (!PAYLOAD_HEX_REGEX.test(payload)) return null;
  return { payload: Buffer.from(payload, 'hex') };
}

/**
 * 校验用户提交明文是否匹配老 iximei 风格的 `###<md5...>`。
 *
 * 调用方**必须**先确认 `password_format === 0`,并显式标注此入口;
 * 任何"由 verifyPassword 隐式回退到这里"都是反向引入安全风险。
 *
 * 使用 constant-time 比较;遇到解析失败返回 `{ valid: false }`,不抛错。
 */
export async function verifyLegacyPassword(
  plaintext: string,
  hash: unknown,
): Promise<LegacyVerification> {
  const parsed = parseThinkCmfLegacyHash(hash);
  if (!parsed) return { valid: false };
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    return { valid: false };
  }
  // 第一次:MD5(authcode + pw) → **hex 字符串**(PHP `md5()` 返回 hex 字符串)
  // 第二次:再 MD5 这个 hex 字符串 → 然后与 hash 片段做 constant-time 比对
  // 注意 Node `createHash(...).digest()` 默认返回 Buffer;必须显式 .digest('hex')
  // 再传入第二次 update,否则会把 raw 16 字节喂给第二次 md5,得到完全不同的结果。
  const once = createHash('md5').update(LEGACY_IXIMEI_AUTHCODE + plaintext, 'utf8').digest('hex');
  const twice = createHash('md5').update(once, 'utf8').digest();
  if (twice.length !== parsed.payload.length) return { valid: false };
  return { valid: timingSafeEqual(twice, parsed.payload) };
}

/**
 * 把明文算成老 iximei 风格的 hash。**仅用于导入脚本 dry-run 验证 + 数据回填**,
 * 不应用到生产登录路径 — 登录路径必须走新系统的 scrypt。
 */
export function hashLegacyPassword(plaintext: string): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new TypeError('plaintext must be a non-empty string');
  }
  const once = createHash('md5').update(LEGACY_IXIMEI_AUTHCODE + plaintext, 'utf8').digest('hex');
  const twice = createHash('md5').update(once, 'utf8').digest('hex');
  return '###' + twice;
}
