/**
 * normalizeMemberPayload：把表单 payload 中的时间字段归一化为后端 schema 期望的格式。
 *
 * 覆盖：
 *   1. dayjs 对象（带 .toDate()）→ YYYY-MM-DD（expectedDate）
 *   2. ISO 字符串 → 保留日期分量（birthday）
 *   3. dayjs 对象 → ISO 字符串（nextFollowUpAt）
 *
 * 后端 schema 在 `apps/yishan-api/src/modules/crm/schemas/members.schema.ts`：
 *   expectedDate / birthday → format:'date'    (YYYY-MM-DD)
 *   nextFollowUpAt          → format:'date-time' (ISO 字符串)
 */

import { normalizeMemberPayload } from '../utils';

describe('normalizeMemberPayload', () => {
  it('把 dayjs 对象的 expectedDate 转为 YYYY-MM-DD', () => {
    const payload = {
      expectedDate: { toDate: () => new Date('2026-08-20T07:00:00Z') },
    } as any;
    const out = normalizeMemberPayload(payload);
    expect(out.expectedDate).toBe('2026-08-20');
  });

  it('birthday 输入 ISO 字符串保持为日期分量', () => {
    const out = normalizeMemberPayload({ birthday: '2026-08-20T07:00:00Z' });
    expect(out.birthday).toBe('2026-08-20');
  });

  it('nextFollowUpAt 转 ISO 字符串', () => {
    const out = normalizeMemberPayload({
      nextFollowUpAt: { toDate: () => new Date('2026-08-20T07:00:00Z') },
    });
    expect(out.nextFollowUpAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('birthday 输入 Date 实例转为 YYYY-MM-DD', () => {
    const out = normalizeMemberPayload({ birthday: new Date('2026-08-20T07:00:00Z') });
    expect(out.birthday).toBe('2026-08-20');
  });

  it('空值原样透传，不抛错', () => {
    const out = normalizeMemberPayload({ expectedDate: undefined, birthday: null, nextFollowUpAt: '' });
    expect(out.expectedDate).toBeUndefined();
    expect(out.birthday).toBeNull();
    expect(out.nextFollowUpAt).toBe('');
  });

  it('保留其它非时间字段', () => {
    const out = normalizeMemberPayload({
      name: '张三',
      mobile: '13800138000',
      expectedDate: { toDate: () => new Date('2026-08-20T07:00:00Z') },
    });
    expect(out.name).toBe('张三');
    expect(out.mobile).toBe('13800138000');
    expect(out.expectedDate).toBe('2026-08-20');
  });
});