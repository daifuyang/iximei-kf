/**
 * extractApiError：从 umi-request 抛出的错误中提取后端真实业务文案。
 *
 * 优先级：
 *   1. e.response.data.message  — umi-request 把 4xx/5xx 的响应体放这里
 *   2. e.data.message           — 某些 wrapper 路径
 *   3. e.message，跳过纯数字（"400"/"500"）
 *   4. null，由调用方兜底中文提示
 *
 * 覆盖：
 *   1. response.data.message 优先
 *   2. data.message 兜底
 *   3. 纯数字 message 返回 null（让默认文案生效）
 *   4. 通用 message 字符串返回自身
 *   5. null/undefined 返回 null
 */

import { extractApiError } from '../utils';

describe('extractApiError', () => {
  it('读出 response.data.message', () => {
    expect(extractApiError({ response: { data: { message: '该手机号已被使用' } } })).toBe('该手机号已被使用');
  });

  it('纯 400/500 数字 message 返回 null', () => {
    expect(extractApiError({ message: '400' })).toBeNull();
    expect(extractApiError({ message: '500' })).toBeNull();
  });

  it('通用 message 返回自身', () => {
    expect(extractApiError({ message: '网络异常' })).toBe('网络异常');
  });

  it('data.message 兜底', () => {
    expect(extractApiError({ data: { message: '业务校验失败' } })).toBe('业务校验失败');
  });

  it('null / undefined 返回 null', () => {
    expect(extractApiError(null)).toBeNull();
    expect(extractApiError(undefined)).toBeNull();
  });

  it('response.data.message 优先于 e.message', () => {
    expect(
      extractApiError({
        response: { data: { message: '业务错误' } },
        message: 'Request failed with status code 400',
      }),
    ).toBe('业务错误');
  });
});