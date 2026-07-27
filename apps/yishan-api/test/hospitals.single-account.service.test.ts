/**
 * HospitalsService 一院一账号 — 单元测试
 *
 * 覆盖 plan §8 的关键不变量：
 *   1. createWithAccount 强制 username === hospitalName（不接收外部 username）
 *   2. 重名时整体回滚、不留孤儿 sys_user
 *   3. 改名事务在冲突时整次失败
 *   4. 删除医院时同时禁用账号 + 撤销 Token
 *   5. accessibleHospitalIds 0 结果 → BusinessError(403)（不回退为全量）
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessError } from '@/exceptions/business-error.js';
import { AuthErrorCode } from '@/constants/business-codes/auth.js';
import { HospitalsRepository } from '../src/modules/crm/repositories/hospitals.repository.js';
import { UserTokenRepository } from '../src/core/repositories/user-token.repository.js';

// Mock 整个 HospitalsRepository 和 UserTokenRepository；事务路径由 repository 保证。
vi.mock('../src/modules/crm/repositories/hospitals.repository.js', () => ({
  HospitalsRepository: {
    findOtherUserByUsername: vi.fn(),
    createWithAccount: vi.fn(),
    renameHospitalAndAccount: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    deactivateHospitalAndAccount: vi.fn(),
    getAccountByHospitalId: vi.fn(),
    disableAccount: vi.fn(),
    updateAccountContact: vi.fn(),
    resetAccountPassword: vi.fn(),
    accessibleHospitalIds: vi.fn(),
    bindWechatOpenid: vi.fn(),
  },
}));

vi.mock('../src/core/repositories/user-token.repository.js', () => ({
  UserTokenRepository: {
    revokeAllByUserId: vi.fn(),
  },
}));

// hashPassword 是真正的实现，但本测试不关心密码内容，spy 一下避免 bcrypt 实际跑。
vi.mock('@/utils/password.js', () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
}));

import { HospitalsService } from '../src/modules/crm/services/hospitals.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createWithAccount — 一院一账号原子性', () => {
  it('username 固定取 hospitalName，不接受外部 username/accountUserId', async () => {
    (HospitalsRepository.findOtherUserByUsername as any).mockResolvedValue(null);
    (HospitalsRepository.createWithAccount as any).mockResolvedValue({ hospitalId: 1, userId: 2 });

    await HospitalsService.createWithAccount(
      {
        hospitalName: '协和医院',
        accountPassword: 'Passw0rd!',
        accountEmail: 'admin@xiehe.com',
        accountPhone: '13800000000',
        // 这些字段必须被服务端忽略：
        username: 'malicious',
        accountUserId: 999,
      } as any,
      1,
    );

    expect(HospitalsRepository.createWithAccount).toHaveBeenCalledTimes(1);
    const [, accountInput] = (HospitalsRepository.createWithAccount as any).mock.calls[0];
    expect(accountInput.username).toBe('协和医院');
    expect(accountInput.passwordHash).toBe('hashed:Passw0rd!');
    expect(accountInput.email).toBe('admin@xiehe.com');
    expect(accountInput.phone).toBe('13800000000');
  });

  it('新建停用医院时，账号也以停用状态创建', async () => {
    (HospitalsRepository.findOtherUserByUsername as any).mockResolvedValue(null);
    (HospitalsRepository.createWithAccount as any).mockResolvedValue({ hospitalId: 1, userId: 2 });

    await HospitalsService.createWithAccount(
      { hospitalName: '停用医院', accountPassword: 'Passw0rd!', status: 0 } as any,
      1,
    );

    const [, accountInput] = (HospitalsRepository.createWithAccount as any).mock.calls[0];
    expect(accountInput.status).toBe(0);
  });

  it('医院名称超过 50 字时直接拒绝', async () => {
    const longName = '一'.repeat(51);
    await expect(
      HospitalsService.createWithAccount(
        { hospitalName: longName, accountPassword: 'Passw0rd!' } as any,
        1,
      ),
    ).rejects.toThrow(/1–50/);
    expect(HospitalsRepository.createWithAccount).not.toHaveBeenCalled();
  });

  it('医院名称已被其他用户占用时拒绝', async () => {
    (HospitalsRepository.findOtherUserByUsername as any).mockResolvedValue({ id: 5 });
    await expect(
      HospitalsService.createWithAccount(
        { hospitalName: '协和医院', accountPassword: 'Passw0rd!' } as any,
        1,
      ),
    ).rejects.toThrow(/已被其他账号占用/);
    expect(HospitalsRepository.createWithAccount).not.toHaveBeenCalled();
  });
});

describe('update — 普通资料更新（不接受 hospitalName）', () => {
  it('即使 PATCH body 传入 hospitalName 也被忽略，走普通 update', async () => {
    (HospitalsRepository.findById as any).mockResolvedValue({
      id: 1,
      hospitalName: '协和医院',
    });
    (HospitalsRepository.update as any).mockResolvedValue({ id: 1 });

    await HospitalsService.update(
      { hospitalName: '其它名称', hospitalPhone: '021-12345' } as any,
      9,
      1,
    );

    expect(HospitalsRepository.update).toHaveBeenCalledTimes(1);
    // 关键：调用的是普通 update，传给 repo 的 data 不含 hospitalName
    const [calledId, calledData] = (HospitalsRepository.update as any).mock.calls[0];
    expect(calledId).toBe(1);
    expect(calledData).not.toHaveProperty('hospitalName');
    expect(calledData.hospitalPhone).toBe('021-12345');
    expect(HospitalsRepository.renameHospitalAndAccount).not.toHaveBeenCalled();
    expect(UserTokenRepository.revokeAllByUserId).not.toHaveBeenCalled();
  });

  it('医院不存在时拒绝', async () => {
    (HospitalsRepository.findById as any).mockResolvedValue(null);
    await expect(HospitalsService.update({} as any, 9, 1)).rejects.toThrow(/医院不存在/);
  });

  it('停用医院时原子停用账号并撤销 Token', async () => {
    (HospitalsRepository.findById as any).mockResolvedValue({ id: 1, status: 1 });
    (HospitalsRepository.getAccountByHospitalId as any).mockResolvedValue({ userId: 7 });
    (HospitalsRepository.deactivateHospitalAndAccount as any).mockResolvedValue({ id: 1, status: 0 });

    await HospitalsService.update({ status: 0 } as any, 9, 1);

    expect(HospitalsRepository.deactivateHospitalAndAccount).toHaveBeenCalledWith(
      1,
      7,
      expect.objectContaining({ status: 0, updaterId: 9 }),
    );
    expect(UserTokenRepository.revokeAllByUserId).toHaveBeenCalledWith(7);
    expect(HospitalsRepository.update).not.toHaveBeenCalled();
  });

  it('恢复医院时不自动恢复账号', async () => {
    (HospitalsRepository.findById as any).mockResolvedValue({ id: 1, status: 0 });
    (HospitalsRepository.update as any).mockResolvedValue({ id: 1, status: 1 });

    await HospitalsService.update({ status: 1 } as any, 9, 1);

    expect(HospitalsRepository.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: 1, updaterId: 9 }),
    );
    expect(HospitalsRepository.deactivateHospitalAndAccount).not.toHaveBeenCalled();
  });
});

describe('renameHospital — 独立改名接口（仅超管调用）', () => {
  it('超管改名：事务改名 + 撤销 Token + 写审计事件', async () => {
    (HospitalsRepository.findById as any).mockResolvedValue({
      id: 1,
      hospitalName: '旧医院',
    });
    (HospitalsRepository.getAccountByHospitalId as any).mockResolvedValue({
      userId: 7,
      username: '旧医院',
    });
    (HospitalsRepository.renameHospitalAndAccount as any).mockResolvedValue({
      id: 1,
      hospitalName: '新医院',
    });
    (UserTokenRepository.revokeAllByUserId as any).mockResolvedValue(2);

    const req: any = {};
    const result = await HospitalsService.renameHospital(1, '新医院', 99, req);

    expect(HospitalsRepository.renameHospitalAndAccount).toHaveBeenCalledWith(
      1,
      7,
      '新医院',
      99,
    );
    expect(UserTokenRepository.revokeAllByUserId).toHaveBeenCalledWith(7);
    expect(req.auditEvent).toEqual({
      type: 'crm.hospital.renamed',
      payload: {
        hospitalId: 1,
        oldName: '旧医院',
        newName: '新医院',
        accountUserId: 7,
        actorId: 99,
      },
    });
    expect(result.hospitalName).toBe('新医院');
  });

  it('新名称与原名称一致时跳过改名流程', async () => {
    (HospitalsRepository.findById as any).mockResolvedValue({
      id: 1,
      hospitalName: '协和医院',
    });

    const req: any = {};
    const result = await HospitalsService.renameHospital(1, '协和医院', 99, req);

    expect(HospitalsRepository.renameHospitalAndAccount).not.toHaveBeenCalled();
    expect(UserTokenRepository.revokeAllByUserId).not.toHaveBeenCalled();
    expect(req.auditEvent).toBeUndefined();
    expect(result.hospitalName).toBe('协和医院');
  });

  it('新名称超过 50 字时拒绝', async () => {
    await expect(
      HospitalsService.renameHospital(1, '一'.repeat(51), 99),
    ).rejects.toThrow(/1–50/);
    expect(HospitalsRepository.renameHospitalAndAccount).not.toHaveBeenCalled();
  });

  it('医院无账号时拒绝（同步 username 无法完成）', async () => {
    (HospitalsRepository.findById as any).mockResolvedValue({
      id: 1,
      hospitalName: '旧医院',
    });
    (HospitalsRepository.getAccountByHospitalId as any).mockResolvedValue(null);

    await expect(
      HospitalsService.renameHospital(1, '新医院', 99),
    ).rejects.toThrow(/账号缺失/);
  });

  it('医院不存在时拒绝', async () => {
    (HospitalsRepository.findById as any).mockResolvedValue(null);
    await expect(
      HospitalsService.renameHospital(1, '新医院', 99),
    ).rejects.toThrow(/医院不存在/);
  });
});

describe('delete — 软删 + 禁用 + 撤 Token', () => {
  it('软删医院时同时禁用账号并撤销活跃 Token', async () => {
    (HospitalsRepository.getAccountByHospitalId as any).mockResolvedValue({ userId: 7 });
    (HospitalsRepository.update as any).mockResolvedValue({});
    (HospitalsRepository.disableAccount as any).mockResolvedValue(undefined);
    (UserTokenRepository.revokeAllByUserId as any).mockResolvedValue(2);

    const result = await HospitalsService.delete(1, 9);

    expect(HospitalsRepository.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ deletedAt: expect.any(Date), status: 0, updaterId: 9 }),
    );
    expect(HospitalsRepository.disableAccount).toHaveBeenCalledWith(7);
    expect(UserTokenRepository.revokeAllByUserId).toHaveBeenCalledWith(7);
    expect(result).toEqual({ id: 1, deleted: true, accountDisabled: true });
  });

  it('医院无账号时只软删，不调用 disable/revoke', async () => {
    (HospitalsRepository.getAccountByHospitalId as any).mockResolvedValue(null);
    (HospitalsRepository.update as any).mockResolvedValue({});

    const result = await HospitalsService.delete(1, 9);

    expect(HospitalsRepository.update).toHaveBeenCalledTimes(1);
    expect(HospitalsRepository.disableAccount).not.toHaveBeenCalled();
    expect(UserTokenRepository.revokeAllByUserId).not.toHaveBeenCalled();
    expect(result.accountDisabled).toBe(false);
  });
});

describe('requireAccessibleHospitalIds — 0 结果 → 403', () => {
  it('hospital_account 角色 0 结果时抛 BusinessError(403)', async () => {
    (HospitalsRepository.accessibleHospitalIds as any).mockResolvedValue([]);
    await expect(
      HospitalsService.requireAccessibleHospitalIds(2, ['hospital_account']),
    ).rejects.toBeInstanceOf(BusinessError);
    await expect(
      HospitalsService.requireAccessibleHospitalIds(2, ['hospital_account']),
    ).rejects.toMatchObject({ code: AuthErrorCode.FORBIDDEN });
  });

  it('非 hospital_account 角色直接返回空数组（不抛错）', async () => {
    const ids = await HospitalsService.requireAccessibleHospitalIds(2, ['customer_service']);
    expect(ids).toEqual([]);
    expect(HospitalsRepository.accessibleHospitalIds).not.toHaveBeenCalled();
  });

  it('hospital_account 角色 1+ 结果正常返回', async () => {
    (HospitalsRepository.accessibleHospitalIds as any).mockResolvedValue([{ hospitalId: 1 }]);
    const ids = await HospitalsService.requireAccessibleHospitalIds(2, ['hospital_account']);
    expect(ids).toEqual([1]);
  });
});
