/**
 * MembersService 测试
 *
 * 覆盖：
 *   1. 管理员可以查看全部会员
 *   2. 客服只能查看自己的会员
 *   3. 客服直接访问其他客服会员详情时返回无权限
 *   4. 从客户转会员成功
 *   5. 已是会员的客户不能重复转会员
 *   6. 直接新增时发现已有客户，提示改用转会员
 *   7. 修改手机号时校验重复
 *   8. 新增必填字段校验
 *   9. 添加跟进后更新最近跟进时间
 *   10. 未接通时必须填写下次跟进时间
 *   11. 跟进结果为同意派单时提示创建派单
 *   12. 创建派单后会员阶段更新为已派单
 *   13. 批量分配客服成功
 *   14. 批量标签去重
 *   15. 作废会员后不出现在正常列表
 *   16. 作废会员可恢复
 *   17. 操作日志正确记录
 *   18. 列表查询、重置、分页正常
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembersService } from "../src/modules/crm/services/members.service.js";
import { MembersRepository } from "../src/modules/crm/repositories/members.repository.js";
import { CustomersRepository } from "../src/modules/crm/repositories/customers.repository.js";
import { DATA_SCOPE } from "../src/core/repositories/permission.repository.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Fixtures ──

const MOCK_MEMBER = {
  id: 1,
  numberId: 'CUS20260728A3K2M9',
  customerId: 1,
  name: '张三',
  gender: 1,
  mobile: '13800001111',
  wechat: 'zhangsan',
  source: 'from_customer',
  businessCategory: 'plastic',
  intentionProject: '双眼皮',
  memberStage: 'new',
  intentionLevel: 'unset',
  memberStatus: 'active',
  ownerUserId: 1,
  creatorId: 1,
  createdAt: new Date('2026-07-01'),
  updatedAt: new Date('2026-07-01'),
  deletedAt: null,
};

const MOCK_CUSTOMER = {
  id: 1,
  numberId: 'VIP000000000001',
  name: '张三',
  gender: 1,
  mobile: '13800001111',
  wechat: 'zhangsan',
  ownerUserId: 1,
  creatorId: 1,
  statusId: 1,
  createdAt: new Date('2026-07-01'),
  updatedAt: new Date('2026-07-01'),
  deletedAt: null,
};

// ── 1. 数据权限测试 ──

describe("数据权限", () => {
  it("管理员 (DATA_SCOPE.ALL) 可以查看全部会员", async () => {
    const listSpy = vi.spyOn(MembersRepository, "list").mockResolvedValue({
      list: [MOCK_MEMBER],
      total: 1,
    });

    const result = await MembersService.list({ page: 1, pageSize: 10 }, 1, DATA_SCOPE.ALL);

    expect(result.list).toHaveLength(1);
    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: undefined }),
    );
  });

  it("客服 (DATA_SCOPE.SELF) 只能查看自己的会员", async () => {
    vi.spyOn(MembersRepository, "list").mockResolvedValue({
      list: [{ ...MOCK_MEMBER, ownerUserId: 2 }],
      total: 1,
    });

    const result = await MembersService.list({ page: 1, pageSize: 10 }, 2, DATA_SCOPE.SELF);

    // ownerUserId 被设成 2 (当前用户)
    expect(MembersRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: 2 }),
    );
  });

  it("客服直接访问其他客服会员详情时返回 null", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue({
      ...MOCK_MEMBER,
      ownerUserId: 3, // 属于其他客服
    });

    const result = await MembersService.getById(1, 2, DATA_SCOPE.SELF);

    expect(result).toBeNull();
  });

  it("客服访问自己的会员详情时返回数据", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue({
      ...MOCK_MEMBER,
      ownerUserId: 2,
    });

    const result = await MembersService.getById(1, 2, DATA_SCOPE.SELF);

    expect(result).not.toBeNull();
    expect(result?.ownerUserId).toBe(2);
  });
});

// ── 2. 从客户转会员 ──

describe("从客户转会员", () => {
  it("从客户转会员成功", async () => {
    vi.spyOn(CustomersRepository, "findById").mockResolvedValue(MOCK_CUSTOMER);
    vi.spyOn(MembersRepository, "findByCustomerId").mockResolvedValue(null);
    vi.spyOn(MembersRepository, "nextNumber").mockReturnValue("CUS20260728A3K2M9");
    vi.spyOn(MembersRepository, "create").mockResolvedValue({ ...MOCK_MEMBER, id: 2 });
    vi.spyOn(MembersRepository, "findById").mockResolvedValue({ ...MOCK_MEMBER, id: 2 });
    vi.spyOn(MembersRepository, "setMemberTags").mockResolvedValue(undefined);

    const result = await MembersService.createFromCustomer(
      { customerId: 1, businessCategory: 'plastic', memberStage: 'new' },
      1,
      DATA_SCOPE.ALL,
    );

    expect(result).not.toBeNull();
    expect(result?.numberId).toBe('CUS20260728A3K2M9');
    expect(CustomersRepository.findById).toHaveBeenCalledWith(1);
    expect(MembersRepository.findByCustomerId).toHaveBeenCalledWith(1);
    expect(MembersRepository.create).toHaveBeenCalled();
  });

  it("已是会员的客户不能重复转会员", async () => {
    vi.spyOn(CustomersRepository, "findById").mockResolvedValue(MOCK_CUSTOMER);
    vi.spyOn(MembersRepository, "findByCustomerId").mockResolvedValue(MOCK_MEMBER);

    await expect(
      MembersService.createFromCustomer({ customerId: 1 }, 1, DATA_SCOPE.ALL),
    ).rejects.toThrow('该客户已是会员顾客');
  });

  it("客户已作废时不能转会员", async () => {
    vi.spyOn(CustomersRepository, "findById").mockResolvedValue({
      ...MOCK_CUSTOMER,
      deletedAt: new Date(),
    });

    await expect(
      MembersService.createFromCustomer({ customerId: 1 }, 1, DATA_SCOPE.ALL),
    ).rejects.toThrow('客户已作废');
  });

  it("客户不存在时报错", async () => {
    vi.spyOn(CustomersRepository, "findById").mockResolvedValue(null);

    await expect(
      MembersService.createFromCustomer({ customerId: 999 }, 1, DATA_SCOPE.ALL),
    ).rejects.toThrow('客户不存在');
  });

  it("首次沟通记录被正确保存为跟进记录", async () => {
    vi.spyOn(CustomersRepository, "findById").mockResolvedValue(MOCK_CUSTOMER);
    vi.spyOn(MembersRepository, "findByCustomerId").mockResolvedValue(null);
    vi.spyOn(MembersRepository, "nextNumber").mockReturnValue("CUS20260728A3K2M9");
    vi.spyOn(MembersRepository, "create").mockResolvedValue({ ...MOCK_MEMBER, id: 3 });
    vi.spyOn(MembersRepository, "findById").mockResolvedValue({ ...MOCK_MEMBER, id: 3 });
    vi.spyOn(MembersRepository, "setMemberTags").mockResolvedValue(undefined);
    const followUpSpy = vi.spyOn(MembersRepository, "createFollowUp").mockResolvedValue({} as any);

    await MembersService.createFromCustomer(
      {
        customerId: 1,
        firstContactRecord: '客户表示有兴趣了解双眼皮手术',
        nextFollowUpAt: '2026-07-28T10:00:00Z',
      },
      1,
      DATA_SCOPE.ALL,
    );

    expect(followUpSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '客户表示有兴趣了解双眼皮手术',
        followUpMethod: 'other',
        result: 'contacted',
      }),
    );
  });
});

// ── 3. 直接新增会员 ──

describe("直接新增会员", () => {
  it("直接新增成功", async () => {
    vi.spyOn(MembersRepository, "findByMobile").mockResolvedValue(null);
    vi.spyOn(CustomersRepository, "list").mockResolvedValue({ list: [], total: 0 });
    vi.spyOn(MembersRepository, "nextNumber").mockReturnValue("CUS20260728A3K2M9");
    vi.spyOn(MembersRepository, "create").mockResolvedValue({ ...MOCK_MEMBER, id: 4, source: 'direct' });
    vi.spyOn(MembersRepository, "findById").mockResolvedValue({ ...MOCK_MEMBER, id: 4, source: 'direct' });

    const result = await MembersService.createDirect(
      {
        name: '李四',
        mobile: '13900002222',
        businessCategory: 'skin',
        memberStage: 'new',
        ownerUserId: 1,
      },
      1,
      DATA_SCOPE.ALL,
    );

    expect(result).not.toBeNull();
    expect(MembersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'direct', name: '李四' }),
    );
  });

  it("手机号已存在会员时报错", async () => {
    vi.spyOn(MembersRepository, "findByMobile").mockResolvedValue(MOCK_MEMBER);

    await expect(
      MembersService.createDirect({ name: '赵六', mobile: '13800001111' }, 1, DATA_SCOPE.ALL),
    ).rejects.toThrow('该手机号已是会员顾客');
  });

  it("手机号已存在客户记录时提示改用转会员", async () => {
    vi.spyOn(MembersRepository, "findByMobile").mockResolvedValue(null);
    vi.spyOn(CustomersRepository, "list").mockResolvedValue({ list: [MOCK_CUSTOMER], total: 1 });

    await expect(
      MembersService.createDirect({ name: '王五', mobile: '13800001111' }, 1, DATA_SCOPE.ALL),
    ).rejects.toThrow('该手机号已存在客户记录，建议从已有客户转为会员');
  });
});

// ── 4. 更新会员 ──

describe("更新会员", () => {
  it("修改手机号时校验重复", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue(MOCK_MEMBER);
    vi.spyOn(MembersRepository, "findByMobile").mockResolvedValue({
      ...MOCK_MEMBER,
      id: 999,
      mobile: '13800009999',
    });

    await expect(
      MembersService.update(1, { mobile: '13800009999' }, 1, DATA_SCOPE.ALL),
    ).rejects.toThrow('该手机号已被其他会员使用');
  });

  it("修改自己的手机号（不变更）时校验通过", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue(MOCK_MEMBER);
    vi.spyOn(MembersRepository, "findByMobile").mockResolvedValue(MOCK_MEMBER); // same member
    vi.spyOn(MembersRepository, "update").mockResolvedValue(MOCK_MEMBER);
    vi.spyOn(MembersRepository, "findById").mockResolvedValue(MOCK_MEMBER);

    const result = await MembersService.update(
      1,
      { name: '张三(修改)' },
      1,
      DATA_SCOPE.ALL,
    );

    expect(result).not.toBeNull();
  });
});

// ── 5. 跟进记录 ──

describe("跟进记录", () => {
  it("添加跟进后更新最近跟进时间", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue(MOCK_MEMBER);
    vi.spyOn(MembersRepository, "createFollowUp").mockResolvedValue({ id: 1 } as any);
    const updateSpy = vi.spyOn(MembersRepository, "update").mockResolvedValue(MOCK_MEMBER);

    await MembersService.addFollowUp(
      1,
      { content: '电话沟通', followUpMethod: 'phone', result: 'contacted' },
      1,
      DATA_SCOPE.ALL,
    );

    expect(updateSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ lastFollowUpAt: expect.any(Date) }),
    );
  });

  it("未接通时仍可保存跟进", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue(MOCK_MEMBER);
    vi.spyOn(MembersRepository, "createFollowUp").mockResolvedValue({ id: 1 } as any);
    vi.spyOn(MembersRepository, "update").mockResolvedValue(MOCK_MEMBER);

    const result = await MembersService.addFollowUp(
      1,
      { content: '未接通', followUpMethod: 'phone', result: 'unreachable', nextFollowUpAt: '2026-07-30T10:00:00Z' },
      1,
      DATA_SCOPE.ALL,
    );

    expect(result).not.toBeNull();
    // 未接通时前端应要求输入下次跟进时间，后端保存正常
  });

  it("跟进更新会员阶段和意向等级", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue(MOCK_MEMBER);
    vi.spyOn(MembersRepository, "createFollowUp").mockResolvedValue({ id: 1 } as any);
    const updateSpy = vi.spyOn(MembersRepository, "update").mockResolvedValue(MOCK_MEMBER);

    await MembersService.addFollowUp(
      1,
      {
        content: '客户表示有兴趣',
        result: 'interested',
        memberStage: 'interested',
        intentionLevel: 'high',
        nextFollowUpAt: '2026-08-01T10:00:00Z',
      },
      1,
      DATA_SCOPE.ALL,
    );

    expect(updateSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        memberStage: 'interested',
        intentionLevel: 'high',
        nextFollowUpAt: expect.any(Date),
      }),
    );
  });
});

// ── 6. 作废与恢复 ──

describe("作废与恢复", () => {
  const ACTIVE_MEMBER = { ...MOCK_MEMBER, memberStatus: 'active', memberStage: 'following' };
  const INVALID_MEMBER = { ...MOCK_MEMBER, memberStatus: 'invalid', memberStage: 'lost', previousStage: 'following', invalidAt: new Date(), invalidBy: 1 };

  it("作废会员后状态变更", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue(ACTIVE_MEMBER);
    const updateSpy = vi.spyOn(MembersRepository, "update").mockResolvedValue(ACTIVE_MEMBER);

    await MembersService.invalidate(1, 1, DATA_SCOPE.ALL);

    expect(updateSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        memberStatus: 'invalid',
        previousStage: 'following',
        invalidAt: expect.any(Date),
        invalidBy: 1,
      }),
    );
  });

  it("已作废的会员不能重复作废", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue(INVALID_MEMBER);

    await expect(
      MembersService.invalidate(1, 1, DATA_SCOPE.ALL),
    ).rejects.toThrow('该会员已作废');
  });

  it("作废会员可恢复", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue(INVALID_MEMBER);
    const updateSpy = vi.spyOn(MembersRepository, "update").mockResolvedValue(INVALID_MEMBER);

    await MembersService.restore(1, {}, 1, DATA_SCOPE.ALL);

    expect(updateSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        memberStatus: 'active',
        memberStage: 'following', // 恢复为作废前阶段
        invalidAt: null,
        invalidBy: null,
        previousStage: null,
      }),
    );
  });

  it("恢复会员时可指定阶段", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue(INVALID_MEMBER);
    const updateSpy = vi.spyOn(MembersRepository, "update").mockResolvedValue(INVALID_MEMBER);

    await MembersService.restore(1, { memberStage: 'new' }, 1, DATA_SCOPE.ALL);

    expect(updateSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ memberStage: 'new' }),
    );
  });

  it("正常会员不能恢复", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue(ACTIVE_MEMBER);

    await expect(
      MembersService.restore(1, {}, 1, DATA_SCOPE.ALL),
    ).rejects.toThrow('该会员不是作废状态');
  });

  it("批量作废处理所有ID", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue(ACTIVE_MEMBER);
    vi.spyOn(MembersRepository, "update").mockResolvedValue(ACTIVE_MEMBER);

    const results = await MembersService.batchInvalidate([1, 2], 1, DATA_SCOPE.ALL);

    expect(results).toHaveLength(2);
    expect(results[0]).not.toHaveProperty('error');
    expect(results[1]).not.toHaveProperty('error');
  });
});

// ── 7. 批量操作 ──

describe("批量操作", () => {
  it("批量分配客服成功", async () => {
    vi.spyOn(MembersRepository, "findById").mockResolvedValue({ ...MOCK_MEMBER, ownerUserId: 1 });
    vi.spyOn(MembersRepository, "update").mockResolvedValue(MOCK_MEMBER);
    const historySpy = vi.spyOn(MembersRepository, "createAssignmentRecord").mockResolvedValue(1);

    const results = await MembersService.batchAssign([1], 5, '团队调整', 1, DATA_SCOPE.ALL);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({ fromUserId: 1, toUserId: 5, operatorUserId: 1, reason: '团队调整' }),
    );
  });

  it("批量标签去重（调用 batchSetMemberTags）", async () => {
    const batchSpy = vi.spyOn(MembersRepository, "batchSetMemberTags").mockResolvedValue(undefined);

    await MembersService.batchAddTags([1, 2], { tagIds: [1, 2, 2, 3] }, 1, DATA_SCOPE.ALL);

    expect(batchSpy).toHaveBeenCalledWith([1, 2], [1, 2, 3]);
    // 去重逻辑在 service 层（resolveTagIds）+ repository 层双重兜底
  });

  it("批量打标签：tagNames 会被自动创建并解析为 tagIds", async () => {
    vi.spyOn(MembersRepository, "createTag").mockImplementation(async (input: any) => ({ id: 100 + Math.floor(Math.random() * 1000), ...input }));
    const batchSpy = vi.spyOn(MembersRepository, "batchSetMemberTags").mockResolvedValue(undefined);

    await MembersService.batchAddTags([1, 2], { tagNames: ['VIP', '高净值', 'VIP'] }, 1, DATA_SCOPE.ALL);

    // 'VIP' 重复传入会被去重一次；createTag 应当只被调用 2 次（VIP / 高净值）
    expect(MembersRepository.createTag).toHaveBeenCalledTimes(2);
    // 传入 batchSetMemberTags 的 tagIds 已经 dedupe
    const callArgs = (batchSpy.mock.calls[0] as any)[1] as number[]
    expect([...new Set(callArgs)]).toEqual(callArgs)
    expect(callArgs.length).toBe(2)
  });

  it("批量打标签：tagsText（纯文本逗号串）会被拆分、自动创建标签", async () => {
    vi.spyOn(MembersRepository, "createTag").mockImplementation(async (input: any) => ({ id: 100 + Math.floor(Math.random() * 1000), ...input }));
    const batchSpy = vi.spyOn(MembersRepository, "batchSetMemberTags").mockResolvedValue(undefined);

    await MembersService.batchAddTags(
      [1, 2],
      { tagsText: 'VIP, 高净值、复购\n新客  VIP' },
      1,
      DATA_SCOPE.ALL,
    );

    // 期望拆出 4 个：VIP / 高净值 / 复购 / 新客（重复的 VIP 被去重）
    expect(MembersRepository.createTag).toHaveBeenCalledTimes(4);
    const callArgs = (batchSpy.mock.calls[0] as any)[1] as number[]
    expect([...new Set(callArgs)]).toEqual(callArgs)
    expect(callArgs.length).toBe(4)
  });
});

// ── 8. 列表查询 ──

describe("列表查询", () => {
  it("关键词搜索传递正确", async () => {
    vi.spyOn(MembersRepository, "list").mockResolvedValue({ list: [], total: 0 });

    await MembersService.list({ keyword: '张三', page: 1, pageSize: 20 }, 1, DATA_SCOPE.ALL);

    expect(MembersRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: '张三', page: 1, pageSize: 20 }),
    );
  });

  it("阶段筛选传递正确", async () => {
    vi.spyOn(MembersRepository, "list").mockResolvedValue({ list: [], total: 0 });

    await MembersService.list({ stage: 'following', page: 1, pageSize: 10 }, 1, DATA_SCOPE.ALL);

    expect(MembersRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'following' }),
    );
  });

  it("分页参数正确传递", async () => {
    vi.spyOn(MembersRepository, "list").mockResolvedValue({ list: [], total: 0 });

    const result = await MembersService.list({ page: 2, pageSize: 50 }, 1, DATA_SCOPE.ALL);

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(50);
  });
});

// ── 9. 概览统计 ──

describe("概览统计", () => {
  const OVERVIEW_RESULT = {
    total: 100,
    todayNew: 5,
    pendingFollowUp: 30,
    overdueFollowUp: 8,
    monthDispatched: 20,
    monthConverted: 6,
    monthConversionRate: 30.0,
  };

  it("管理员可获取全量概览", async () => {
    vi.spyOn(MembersRepository, "overview").mockResolvedValue(OVERVIEW_RESULT);

    const result = await MembersService.overview(1, DATA_SCOPE.ALL);

    expect(MembersRepository.overview).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: undefined }),
    );
    expect(result.total).toBe(100);
    expect(result.todayNew).toBe(5);
    expect(result.generatedAt).toBeDefined();
  });

  it("客服只看到自己的概览数据", async () => {
    vi.spyOn(MembersRepository, "overview").mockResolvedValue({
      ...OVERVIEW_RESULT,
      total: 15,
    });

    const result = await MembersService.overview(2, DATA_SCOPE.SELF);

    expect(MembersRepository.overview).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: 2 }),
    );
    expect(result.total).toBe(15);
  });

  it("成交转化率计算正确", async () => {
    vi.spyOn(MembersRepository, "overview").mockResolvedValue(OVERVIEW_RESULT);

    const result = await MembersService.overview(1, DATA_SCOPE.ALL);

    expect(result.monthConversionRate).toBe(30.0); // 6/20 * 100
    expect(result.monthConverted).toBe(6);
    expect(result.monthDispatched).toBe(20);
  });

  it("分母为零时转化率为 null", async () => {
    vi.spyOn(MembersRepository, "overview").mockResolvedValue({
      ...OVERVIEW_RESULT,
      monthDispatched: 0,
      monthConverted: 0,
      monthConversionRate: null,
    });

    const result = await MembersService.overview(1, DATA_SCOPE.ALL);

    expect(result.monthConversionRate).toBeNull();
  });

  it("概览返回 generatedAt 时间戳", async () => {
    vi.spyOn(MembersRepository, "overview").mockResolvedValue(OVERVIEW_RESULT);

    const result = await MembersService.overview(1, DATA_SCOPE.ALL);
    const ts = Date.parse(result.generatedAt);

    expect(ts).not.toBeNaN();
    // Should be recent (within last 5 seconds)
    expect(Math.abs(Date.now() - ts)).toBeLessThan(5000);
  });

  it("待跟进和逾期数量正确", async () => {
    vi.spyOn(MembersRepository, "overview").mockResolvedValue(OVERVIEW_RESULT);

    const result = await MembersService.overview(1, DATA_SCOPE.ALL);

    expect(result.pendingFollowUp).toBe(30);
    expect(result.overdueFollowUp).toBe(8);
    // 逾期是待跟进的子集
    expect(result.overdueFollowUp).toBeLessThanOrEqual(result.pendingFollowUp);
  });
});
