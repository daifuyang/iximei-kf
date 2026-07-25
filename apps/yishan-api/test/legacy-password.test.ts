import { describe, expect, it } from 'vitest';
import {
  hashLegacyPassword,
  LEGACY_IXIMEI_AUTHCODE,
  parseThinkCmfLegacyHash,
  verifyLegacyPassword,
} from '../src/utils/legacy-password';

/**
 * 反向验证样本(2026-07 在老 iximei SQL dump 上回扫命中,
 * 算法 + authcode 由 thinkcmf 5.x cmf-core 源码 + kf.iximei.cn
 * data/config/database.php 双侧对齐):
 *
 *   md5(md5("U02r3D6dXAuB90BbFG" + "111111"))  = 8f1ef4e8b75a8e47a3e6e38dedd1d6a5
 *   md5(md5("U02r3D6dXAuB90BbFG" + "123456"))  = 88bd5c8cc2467de916aecb251325ab6e
 *   md5(md5("U02r3D6dXAuB90BbFG" + "abc123456")) = 5161d8f3514ce21928c5bb8027f6fa8d
 *
 * authcode 默认值与 kf.iximei.cn data/config/database.php 的 'authcode' 一致。
 */
const REVERSED_SAMPLES: Array<[plain: string, payload: string]> = [
  ['111111', '8f1ef4e8b75a8e47a3e6e38dedd1d6a5'],
  ['123456', '88bd5c8cc2467de916aecb251325ab6e'],
  ['abc123456', '5161d8f3514ce21928c5bb8027f6fa8d'],
];

describe('legacy-password', () => {
  it('uses the authcode from kf.iximei.cn data/config/database.php by default', () => {
    expect(LEGACY_IXIMEI_AUTHCODE).toBe('U02r3D6dXAuB90BbFG');
  });

  describe('parseThinkCmfLegacyHash', () => {
    it('parses "###" + 32 hex chars', () => {
      const result = parseThinkCmfLegacyHash('###8f1ef4e8b75a8e47a3e6e38dedd1d6a5');
      expect(result).not.toBeNull();
      expect(result!.payload.toString('hex')).toBe('8f1ef4e8b75a8e47a3e6e38dedd1d6a5');
    });

    it.each([
      'no-prefix',
      '###zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz', // non-hex
      '###8f1ef4e8b75a8e47a3e6e38dedd1d6a',  // 31 chars
      '###8f1ef4e8b75a8e47a3e6e38dedd1d6a5xx', // 34 chars
      '',
      null,
      undefined,
      12345,
      {},
    ])('rejects invalid input %p', (input) => {
      expect(parseThinkCmfLegacyHash(input as unknown)).toBeNull();
    });

    it('is case-insensitive on the hex payload', () => {
      const upper = parseThinkCmfLegacyHash('###8F1EF4E8B75A8E47A3E6E38DEDD1D6A5');
      expect(upper).not.toBeNull();
      const lower = parseThinkCmfLegacyHash('###8f1ef4e8b75a8e47a3e6e38dedd1d6a5');
      expect(lower).not.toBeNull();
      // 大写归一化为同样字节
      expect(upper!.payload.equals(lower!.payload)).toBe(true);
    });
  });

  describe('hashLegacyPassword', () => {
    it.each(REVERSED_SAMPLES)('hashes "%s" to the known payload %s', (plain, payload) => {
      expect(hashLegacyPassword(plain)).toBe(`###${payload}`);
    });

    it('throws on empty plaintext', () => {
      expect(() => hashLegacyPassword('')).toThrow(TypeError);
    });
  });

  describe('verifyLegacyPassword', () => {
    it.each(REVERSED_SAMPLES)('verifies "###%s" as the plaintext "%s"', async (plain, payload) => {
      await expect(verifyLegacyPassword(plain, `###${payload}`)).resolves.toEqual({ valid: true });
    });

    it.each(REVERSED_SAMPLES)(
      'rejects wrong plaintext "wrong" against hash for "%s"',
      async (plain, payload) => {
        await expect(verifyLegacyPassword('wrong', `###${payload}`)).resolves.toEqual({ valid: false });
      },
    );

    it('does NOT cross-match different plaintexts sharing the same hash space', async () => {
      // 反向校验两个哈希值不同
      const hA = hashLegacyPassword('123456');
      const hB = hashLegacyPassword('111111');
      expect(hA).not.toBe(hB);
    });

    it('returns valid:false for malformed hashes instead of throwing', async () => {
      await expect(verifyLegacyPassword('123456', 'not-a-hash')).resolves.toEqual({ valid: false });
      await expect(verifyLegacyPassword('123456', '')).resolves.toEqual({ valid: false });
      await expect(verifyLegacyPassword('123456', '###zzz')).resolves.toEqual({ valid: false });
    });

    it('returns valid:false for empty plaintext', async () => {
      await expect(verifyLegacyPassword('', '###88bd5c8cc2467de916aecb251325ab6e')).resolves.toEqual({
        valid: false,
      });
    });
  });
});
