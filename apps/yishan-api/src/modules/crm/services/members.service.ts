import { MembersRepository } from '../repositories/members.repository.js'
import { CustomersRepository } from '../repositories/customers.repository.js'
import { compact, asDate, pageArgs } from './_shared.js'
import { DATA_SCOPE, type DataScopeCode } from '@/core/repositories/permission.repository.js'

/** owner 字段过滤：SELF 限定，其它档位(ALL)保留全量 */
function ownerScopeFor(scope: DataScopeCode, userId: number): number | undefined {
  if (scope === DATA_SCOPE.SELF) return userId
  return undefined
}

export class MembersService {

  // ── 列表 ──

  static async list(q: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const p = pageArgs(q)
    const ownerUserId = ownerScopeFor(scope, userId)
    return { ...(await MembersRepository.list({ ...q, ...p, ownerUserId })), ...p }
  }

  // ── 概览（顶部卡片） ──

  static async overview(userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const ownerUserId = ownerScopeFor(scope, userId)

    // Compute Asia/Shanghai date boundaries
    const now = new Date()
    // Convert current time to Shanghai date for "today" boundaries
    const shNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
    const shTodayStart = new Date(shNow)
    shTodayStart.setHours(0, 0, 0, 0)
    const shTodayEnd = new Date(shNow)
    shTodayEnd.setHours(23, 59, 59, 999)

    // Convert Shanghai today to UTC for DB query
    const todayStart = new Date(shTodayStart.toUTCString())
    const todayEnd = new Date(shTodayEnd.toUTCString())

    // Month start/end in Shanghai
    const shMonthStart = new Date(shNow.getFullYear(), shNow.getMonth(), 1)
    shMonthStart.setHours(0, 0, 0, 0)
    const shMonthEnd = new Date(shNow.getFullYear(), shNow.getMonth() + 1, 0)
    shMonthEnd.setHours(23, 59, 59, 999)

    const monthStart = new Date(shMonthStart.toUTCString())
    const monthEnd = new Date(shMonthEnd.toUTCString())

    const stats = await MembersRepository.overview({
      todayStart, todayEnd, monthStart, monthEnd, now, ownerUserId,
    })

    return { ...stats, generatedAt: now.toISOString() }
  }

  // ── 详情 ──

  static async getById(id: number, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL, includeAll = false) {
    const m: any = await MembersRepository.findById(id, {
      includeTags: includeAll,
      includeFollowUps: includeAll,
      includeAssignmentHistory: includeAll,
    })
    if (!m) return null
    // Data scope check
    if (ownerScopeFor(scope, userId) === userId && m.ownerUserId !== userId) return null
    // Record browse
    if (includeAll) {
      await MembersRepository.recordBrowse(id, userId).catch(() => {})
    }
    return m
  }

  // ── 轻量详情（列表行快速查看） ──

  static async getBrief(id: number, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    return this.getById(id, userId, scope, false)
  }

  // ── 从客户转会员 ──

  static async createFromCustomer(input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const { customerId, tagIds, firstContactRecord, ...memberFields } = input

    // 检查客户是否存在
    const customer = await CustomersRepository.findById(customerId)
    if (!customer) throw new Error('客户不存在')
    if (customer.deletedAt) throw new Error('客户已作废')

    // 检查客户是否已是会员
    const existingMember = await MembersRepository.findByCustomerId(customerId)
    if (existingMember) {
      const err: any = new Error('该客户已是会员顾客')
      err.existingMember = existingMember
      throw err
    }

    // 检查权限
    if (ownerScopeFor(scope, userId) === userId && customer.ownerUserId !== userId) {
      throw new Error('无权操作该客户')
    }

    // 数据准备
    const data = compact({
      customerId,
      numberId: await MembersRepository.nextNumber(),
      name: customer.name,
      gender: customer.gender,
      birthday: customer.birthday,
      mobile: customer.mobile,
      wechat: customer.wechat,
      qq: customer.qq,
      provinceId: customer.provinceId,
      cityId: customer.cityId,
      districtId: customer.districtId,
      address: customer.address,
      source: 'from_customer',
      businessCategory: memberFields.businessCategory,
      intentionProject: memberFields.intentionProject,
      memberStage: memberFields.memberStage ?? 'new',
      intentionLevel: memberFields.intentionLevel ?? 'unset',
      budgetRange: memberFields.budgetRange,
      expectedDate: asDate(memberFields.expectedDate),
      preferredHospitalId: memberFields.preferredHospitalId === undefined ? undefined : Number(memberFields.preferredHospitalId),
      memberStatus: 'active',
      joinedAt: new Date(),
      ownerUserId: memberFields.ownerUserId ? Number(memberFields.ownerUserId) : customer.ownerUserId,
      creatorId: userId,
      updaterId: userId,
      nextFollowUpAt: memberFields.nextFollowUpAt ? new Date(memberFields.nextFollowUpAt) : undefined,
      remark: memberFields.remark,
    })

    const member = await MembersRepository.create(data)

    // Set tags
    if (tagIds?.length) {
      await MembersRepository.setMemberTags(member.id, tagIds)
      member.tags = await MembersRepository.getMemberTagIds(member.id)
    }

    // Create initial follow-up if first contact provided
    if (firstContactRecord) {
      await MembersRepository.createFollowUp({
        memberId: member.id,
        operatorUserId: userId,
        followUpMethod: 'other',
        content: firstContactRecord,
        result: 'contacted',
        stageAfter: data.memberStage,
        intentionLevelAfter: data.intentionLevel,
        nextFollowUpAt: data.nextFollowUpAt,
      })
    }

    return MembersRepository.findById(member.id, { includeTags: true })
  }

  // ── 直接新增会员 ──

  static async createDirect(input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const { tagIds, firstContactRecord, sourceChannel, ...rest } = input

    // Check mobile uniqueness
    if (rest.mobile) {
      const byMobile = await MembersRepository.findByMobile(rest.mobile)
      if (byMobile) {
        const err: any = new Error('该手机号已是会员顾客')
        err.existingMember = byMobile
        throw err
      }

      // Check if mobile exists in customers
      const customersList = await CustomersRepository.list({
        keyword: rest.mobile,
        pageSize: 1, page: 1,
      })
      if (customersList.list.length > 0) {
        const err: any = new Error('该手机号已存在客户记录，建议从已有客户转为会员')
        err.existingCustomer = customersList.list[0]
        throw err
      }
    }

    const data = compact({
      numberId: await MembersRepository.nextNumber(),
      name: rest.name,
      gender: rest.gender === undefined ? undefined : Number(rest.gender),
      birthday: asDate(rest.birthday),
      mobile: rest.mobile,
      wechat: rest.wechat,
      qq: rest.qq,
      provinceId: rest.provinceId === undefined ? undefined : Number(rest.provinceId),
      cityId: rest.cityId === undefined ? undefined : Number(rest.cityId),
      districtId: rest.districtId === undefined ? undefined : Number(rest.districtId),
      address: rest.address,
      source: 'direct',
      businessCategory: rest.businessCategory,
      intentionProject: rest.intentionProject,
      memberStage: rest.memberStage ?? 'new',
      intentionLevel: rest.intentionLevel ?? 'unset',
      budgetRange: rest.budgetRange,
      expectedDate: asDate(rest.expectedDate),
      preferredHospitalId: rest.preferredHospitalId === undefined ? undefined : Number(rest.preferredHospitalId),
      memberStatus: 'active',
      joinedAt: new Date(),
      ownerUserId: rest.ownerUserId ? Number(rest.ownerUserId) : userId,
      creatorId: userId,
      updaterId: userId,
      nextFollowUpAt: rest.nextFollowUpAt ? new Date(rest.nextFollowUpAt) : undefined,
      remark: rest.remark,
    })

    const member = await MembersRepository.create(data)

    // Set tags
    if (tagIds?.length) {
      await MembersRepository.setMemberTags(member.id, tagIds)
      member.tags = await MembersRepository.getMemberTagIds(member.id)
    }

    // Create initial follow-up
    if (firstContactRecord) {
      await MembersRepository.createFollowUp({
        memberId: member.id,
        operatorUserId: userId,
        followUpMethod: 'other',
        content: firstContactRecord,
        result: 'contacted',
        stageAfter: data.memberStage,
        intentionLevelAfter: data.intentionLevel,
        nextFollowUpAt: data.nextFollowUpAt,
      })
    }

    return MembersRepository.findById(member.id, { includeTags: true })
  }

  // ── 更新会员 ──

  static async update(id: number, input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new Error('会员不存在或无权访问')

    const { tagIds, ...fields } = input

    // Mobile uniqueness check
    if (fields.mobile && fields.mobile !== existing.mobile) {
      const byMobile = await MembersRepository.findByMobile(fields.mobile)
      if (byMobile && byMobile.id !== id) {
        throw new Error('该手机号已被其他会员使用')
      }
    }

    const data = compact({
      name: fields.name,
      gender: fields.gender === undefined ? undefined : Number(fields.gender),
      birthday: asDate(fields.birthday),
      mobile: fields.mobile,
      wechat: fields.wechat,
      qq: fields.qq,
      provinceId: fields.provinceId === undefined ? undefined : Number(fields.provinceId),
      cityId: fields.cityId === undefined ? undefined : Number(fields.cityId),
      districtId: fields.districtId === undefined ? undefined : Number(fields.districtId),
      address: fields.address,
      businessCategory: fields.businessCategory,
      intentionProject: fields.intentionProject,
      memberStage: fields.memberStage,
      intentionLevel: fields.intentionLevel,
      budgetRange: fields.budgetRange,
      expectedDate: asDate(fields.expectedDate),
      preferredHospitalId: fields.preferredHospitalId === undefined ? undefined : Number(fields.preferredHospitalId),
      ownerUserId: fields.ownerUserId === undefined ? undefined : Number(fields.ownerUserId),
      nextFollowUpAt: fields.nextFollowUpAt ? new Date(fields.nextFollowUpAt) : undefined,
      remark: fields.remark,
      updaterId: userId,
    })

    await MembersRepository.update(id, data)

    // Update tags
    if (tagIds !== undefined) {
      await MembersRepository.setMemberTags(id, tagIds)
    }

    return MembersRepository.findById(id, { includeTags: true })
  }

  // ── 添加跟进 ──

  static async addFollowUp(id: number, input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new Error('会员不存在或无权访问')

    const record = await MembersRepository.createFollowUp({
      memberId: id,
      operatorUserId: userId,
      followUpMethod: input.followUpMethod,
      content: input.content,
      result: input.result,
      stageAfter: input.memberStage,
      intentionLevelAfter: input.intentionLevel,
      nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : undefined,
    })

    // Update member's last follow-up time, stage, intention level, next follow-up
    const updateData: any = {
      lastFollowUpAt: new Date(),
      updaterId: userId,
    }
    if (input.memberStage) updateData.memberStage = input.memberStage
    if (input.intentionLevel) updateData.intentionLevel = input.intentionLevel
    if (input.nextFollowUpAt) {
      updateData.nextFollowUpAt = new Date(input.nextFollowUpAt)
    } else if (input.result === 'unreachable') {
      // 未接通必须设置下次跟进时间 — 由前端校验
    }

    await MembersRepository.update(id, updateData)

    return record
  }

  // ── 作废会员 ──

  static async invalidate(id: number, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new Error('会员不存在或无权访问')
    if (existing.memberStatus === 'invalid') throw new Error('该会员已作废')

    await MembersRepository.update(id, {
      memberStatus: 'invalid',
      previousStage: existing.memberStage,
      invalidAt: new Date(),
      invalidBy: userId,
      updaterId: userId,
    })

    return MembersRepository.findById(id, { includeTags: true })
  }

  // ── 批量作废 ──

  static async batchInvalidate(memberIds: number[], userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const results: any[] = []
    for (const id of memberIds) {
      try {
        results.push(await this.invalidate(id, userId, scope))
      } catch (e: any) {
        results.push({ id, error: e.message })
      }
    }
    return results
  }

  // ── 恢复会员 ──

  static async restore(id: number, input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await MembersRepository.findById(id)
    if (!existing) throw new Error('会员不存在')
    if (existing.memberStatus !== 'invalid') throw new Error('该会员不是作废状态')

    await MembersRepository.update(id, {
      memberStatus: 'active',
      memberStage: input.memberStage ?? existing.previousStage ?? 'new',
      invalidAt: null,
      invalidBy: null,
      previousStage: null,
      updaterId: userId,
    })

    return MembersRepository.findById(id, { includeTags: true })
  }

  // ── 批量分配客服 ──

  static async batchAssign(memberIds: number[], toUserId: number, reason: string | undefined, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const results: any[] = []
    for (const id of memberIds) {
      try {
        const existing = await this.getById(id, userId, scope)
        if (!existing) throw new Error('会员不存在或无权访问')

        const fromUserId = existing.ownerUserId

        // Update owner
        await MembersRepository.update(id, { ownerUserId: toUserId, updaterId: userId })

        // Record assignment history
        await MembersRepository.createAssignmentRecord({
          memberId: id,
          fromUserId: fromUserId !== toUserId ? fromUserId : null,
          toUserId,
          operatorUserId: userId,
          reason: reason ?? null,
        })

        results.push({ id, success: true })
      } catch (e: any) {
        results.push({ id, error: e.message })
      }
    }
    return results
  }

  // ── 批量打标签 ──

  static async batchAddTags(memberIds: number[], tagIds: number[], userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    await MembersRepository.batchSetMemberTags(memberIds, tagIds)
    return { success: true, affected: memberIds.length }
  }

  // ── 标签管理 ──

  static async listTags() {
    return MembersRepository.listTags()
  }

  static async createTag(input: any, userId: number) {
    return MembersRepository.createTag({
      name: input.name,
      color: input.color,
      creatorId: userId,
    })
  }

  static async deleteTag(tagId: number) {
    return MembersRepository.deleteTag(tagId)
  }

  // ── 可选择的客户 ──

  static async listSelectableCustomers(q: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const p = pageArgs(q)
    const ownerUserId = ownerScopeFor(scope, userId)
    return { ...(await MembersRepository.listSelectableCustomers({ ...q, ...p, ownerUserId })), ...p }
  }

  // ── 获取跟进记录 ──

  static async listFollowUps(id: number, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new Error('会员不存在或无权访问')
    return MembersRepository.listFollowUps(id)
  }
}
