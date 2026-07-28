/**
 * CustomersService 校验与错误码单元测试。
 *
 * 覆盖：trim、phone/qq/wechat 正则、必填 name、DB errno 翻译、
 *       BusinessError 替代 plain Error、不存在资源 → NOT_FOUND。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BusinessError } from '@/exceptions/business-error.js'
import { ValidationErrorCode } from '@/constants/business-codes/validation.js'
import { UserErrorCode } from '@/constants/business-codes/user.js'
import { ResourceErrorCode } from '@/constants/business-codes/resource.js'

vi.mock('../src/modules/crm/repositories/customers.repository.js', () => ({
  CustomersRepository: {
    ensureDefaultStatuses: vi.fn().mockResolvedValue(undefined),
    nextNumber: vi.fn().mockReturnValue('CUS20260728A3K2M9'),
    create: vi.fn().mockResolvedValue({ id: 1, name: 'mock' }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
    findById: vi.fn(),
    listStatuses: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue({ list: [], total: 0 }),
    addRemark: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../src/modules/crm/repositories/dispatches.repository.js', () => ({
  DispatchesRepository: {},
}))

import { CustomersService } from '../src/modules/crm/services/customers.service.js'
import { CustomersRepository } from '../src/modules/crm/repositories/customers.repository.js'

beforeEach(() => {
  vi.clearAllMocks()
  ;(CustomersRepository.ensureDefaultStatuses as any).mockResolvedValue(undefined)
  ;(CustomersRepository.nextNumber as any).mockReturnValue('CUS20260728A3K2M9')
  ;(CustomersRepository.create as any).mockResolvedValue({ id: 1, name: 'mock' })
  ;(CustomersRepository.update as any).mockResolvedValue({ id: 1, name: 'mock' })
})

describe('create — 必填与长度校验', () => {
  it('name 留空 → BusinessError(PARAMETER_LENGTH_ERROR)', async () => {
    await expect(
      CustomersService.save({ name: '' } as any, 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.PARAMETER_LENGTH_ERROR,
    })
    expect(CustomersRepository.create).not.toHaveBeenCalled()
  })

  it('name 为 3 个空格 → BusinessError(PARAMETER_LENGTH_ERROR)', async () => {
    await expect(
      CustomersService.save({ name: '   ' } as any, 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.PARAMETER_LENGTH_ERROR,
    })
    expect(CustomersRepository.create).not.toHaveBeenCalled()
  })

  it('name 51 字 → BusinessError(PARAMETER_LENGTH_ERROR)', async () => {
    await expect(
      CustomersService.save({ name: '一'.repeat(51) } as any, 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.PARAMETER_LENGTH_ERROR,
    })
    expect(CustomersRepository.create).not.toHaveBeenCalled()
  })

  it('正常 name 通过校验并写入', async () => {
    await CustomersService.save({ name: '张三' } as any, 1, 'ALL' as any)
    expect(CustomersRepository.create).toHaveBeenCalledTimes(1)
    const arg = (CustomersRepository.create as any).mock.calls[0][0]
    expect(arg.name).toBe('张三')
    expect(arg.numberId).toBe('CUS20260728A3K2M9')
    expect(arg.statusId).toBe(1)
    expect(arg.ownerUserId).toBe(1)
  })
})

describe('create — 联系方式格式校验', () => {
  it.each([
    ['mobile', '138abc', 'PHONE_FORMAT_ERROR'],
    ['mobile', '12345', 'PHONE_FORMAT_ERROR'],
    ['mobile', '23800001234', 'PHONE_FORMAT_ERROR'],
  ])('%s=%s → %s', async (field, value) => {
    await expect(
      CustomersService.save({ name: '张三', [field]: value } as any, 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: UserErrorCode.PHONE_FORMAT_ERROR,
    })
  })

  it('合法手机号 13800001234 通过', async () => {
    await CustomersService.save({ name: '张三', mobile: '13800001234' } as any, 1, 'ALL' as any)
    expect(CustomersRepository.create).toHaveBeenCalledTimes(1)
  })

  it('mobile 为 null / 不传都允许', async () => {
    await CustomersService.save({ name: '张三', mobile: null } as any, 1, 'ALL' as any)
    await CustomersService.save({ name: '李四' } as any, 1, 'ALL' as any)
    expect(CustomersRepository.create).toHaveBeenCalledTimes(2)
  })

  it('qq=12345x → PARAMETER_FORMAT_ERROR', async () => {
    await expect(
      CustomersService.save({ name: '张三', qq: '12345x' } as any, 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.PARAMETER_FORMAT_ERROR,
    })
  })

  it('qq=12345 合法', async () => {
    await CustomersService.save({ name: '张三', qq: '12345' } as any, 1, 'ALL' as any)
    expect(CustomersRepository.create).toHaveBeenCalledTimes(1)
  })

  it('wechat=12345（数字开头） → PARAMETER_FORMAT_ERROR', async () => {
    await expect(
      CustomersService.save({ name: '张三', wechat: '12345' } as any, 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.PARAMETER_FORMAT_ERROR,
    })
  })

  it('wechat=abcdefg 合法', async () => {
    await CustomersService.save({ name: '张三', wechat: 'abcdefg' } as any, 1, 'ALL' as any)
    expect(CustomersRepository.create).toHaveBeenCalledTimes(1)
  })
})

describe('create — 日期 / numberId', () => {
  it('birthday=not-a-date → PARAMETER_FORMAT_ERROR', async () => {
    await expect(
      CustomersService.save({ name: '张三', birthday: 'not-a-date' } as any, 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.PARAMETER_FORMAT_ERROR,
    })
  })

  it('birthday=2024-13-99 → PARAMETER_FORMAT_ERROR', async () => {
    await expect(
      CustomersService.save({ name: '张三', birthday: '2024-13-99' } as any, 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.PARAMETER_FORMAT_ERROR,
    })
  })

  it('birthday=1990-01-01 → 写入并保留日期', async () => {
    await CustomersService.save(
      { name: '张三', birthday: '1990-01-01' } as any,
      1,
      'ALL' as any,
    )
    const arg = (CustomersRepository.create as any).mock.calls[0][0]
    expect(arg.birthday).toBe('1990-01-01')
  })

  it('numberId=CUS20260728A3K2M9 与已有 row 冲突 → 重试 5 次仍冲突 → 抛最后一次错误', async () => {
    const dup = new Error("ER_DUP_ENTRY: Duplicate entry 'CUS20260728A3K2M9' for key 'crm_customer.uniq_crm_customer_number_id'") as any
    dup.errno = 1062
    dup.sqlMessage = "Duplicate entry 'CUS20260728A3K2M9' for key 'crm_customer.uniq_crm_customer_number_id'"
    ;(CustomersRepository.create as any).mockRejectedValue(dup)
    await expect(
      CustomersService.save(
        { name: '张三' } as any,
        1,
        'ALL' as any,
      ),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Duplicate entry/),
    })
    expect(CustomersRepository.create).toHaveBeenCalledTimes(5) // 5 次重试
  })

  it('ER_DATA_TOO_LONG(1406) → PARAMETER_LENGTH_ERROR', async () => {
    const err = new Error('Data too long for column') as any
    err.errno = 1406
    err.sqlMessage = 'Data too long'
    ;(CustomersRepository.create as any).mockRejectedValueOnce(err)
    await expect(
      CustomersService.save({ name: '张三' } as any, 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.PARAMETER_LENGTH_ERROR,
    })
  })

  it('ER_TRUNCATED_WRONG_VALUE(1366) → PARAMETER_FORMAT_ERROR', async () => {
    const err = new Error('Truncated incorrect') as any
    err.errno = 1366
    err.sqlMessage = 'Truncated'
    ;(CustomersRepository.create as any).mockRejectedValueOnce(err)
    await expect(
      CustomersService.save({ name: '张三' } as any, 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.PARAMETER_FORMAT_ERROR,
    })
  })
})

describe('update — 缺省 / 提供校验', () => {
  it('PATCH 不传 name 允许（不改名）', async () => {
    ;(CustomersRepository.findById as any).mockResolvedValue({ id: 1, name: '张三' })
    await CustomersService.save({ mobile: '13800001234' } as any, 1, 'ALL' as any, 1)
    const arg = (CustomersRepository.update as any).mock.calls[0][1]
    expect(arg.name).toBeUndefined()
    expect(arg.mobile).toBe('13800001234')
  })

  it('PATCH name=纯空白仍抛 PARAMETER_LENGTH_ERROR', async () => {
    ;(CustomersRepository.findById as any).mockResolvedValue({ id: 1, name: '张三' })
    await expect(
      CustomersService.save({ name: '   ' } as any, 1, 'ALL' as any, 1),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.PARAMETER_LENGTH_ERROR,
    })
  })

  it('PATCH mobile=bad 抛 PHONE_FORMAT_ERROR', async () => {
    ;(CustomersRepository.findById as any).mockResolvedValue({ id: 1, name: '张三' })
    await expect(
      CustomersService.save({ mobile: 'bad' } as any, 1, 'ALL' as any, 1),
    ).rejects.toMatchObject({
      code: UserErrorCode.PHONE_FORMAT_ERROR,
    })
  })

  it('PATCH 不存在的 id 抛 BusinessError(NOT_FOUND)', async () => {
    ;(CustomersRepository.findById as any).mockResolvedValue(null)
    await expect(
      CustomersService.save({ mobile: '13800001234' } as any, 1, 'ALL' as any, 999),
    ).rejects.toBeInstanceOf(BusinessError)
    await expect(
      CustomersService.save({ mobile: '13800001234' } as any, 1, 'ALL' as any, 999),
    ).rejects.toMatchObject({
      code: ResourceErrorCode.NOT_FOUND,
    })
  })
})

describe('dispatch / addRemark / delete — 错误码', () => {
  it('dispatch 不传 hospitalIds → MISSING_PARAMETER', async () => {
    ;(CustomersRepository.findById as any).mockResolvedValue({ id: 1, name: '张三' })
    await expect(
      CustomersService.dispatch(1, {} as any, 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.MISSING_PARAMETER,
    })
  })

  it('dispatch 不存在的 id → NOT_FOUND', async () => {
    ;(CustomersRepository.findById as any).mockResolvedValue(null)
    await expect(
      CustomersService.dispatch(99, { hospitalIds: [1] } as any, 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: ResourceErrorCode.NOT_FOUND,
    })
  })

  it('addRemark 留空 → MISSING_PARAMETER', async () => {
    ;(CustomersRepository.findById as any).mockResolvedValue({ id: 1, name: '张三' })
    await expect(
      CustomersService.addRemark(1, '   ', 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.MISSING_PARAMETER,
    })
  })

  it('addRemark 成功 → trim 后写入', async () => {
    ;(CustomersRepository.findById as any).mockResolvedValue({ id: 1, name: '张三' })
    await CustomersService.addRemark(1, '  需要二次回访  ', 1, 'ALL' as any)
    const arg = (CustomersRepository.addRemark as any).mock.calls[0][2]
    expect(arg).toBe('需要二次回访')
  })

  it('delete 不存在的 id → NOT_FOUND', async () => {
    ;(CustomersRepository.findById as any).mockResolvedValue(null)
    await expect(
      CustomersService.delete(999, 1, 'ALL' as any),
    ).rejects.toMatchObject({
      code: ResourceErrorCode.NOT_FOUND,
    })
  })
})
