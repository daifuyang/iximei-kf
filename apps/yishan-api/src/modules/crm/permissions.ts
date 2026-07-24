import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js'

export const PERMS = Object.freeze({
  HOSPITAL_LIST: { code: 'crm:hospitals:list', label: 'CRM-医院-查看', group: 'crm' }, HOSPITAL_CREATE: { code: 'crm:hospitals:create', label: 'CRM-医院-新建', group: 'crm' }, HOSPITAL_UPDATE: { code: 'crm:hospitals:update', label: 'CRM-医院-编辑', group: 'crm' }, HOSPITAL_DELETE: { code: 'crm:hospitals:delete', label: 'CRM-医院-删除', group: 'crm' },
  CUSTOMER_LIST: { code: 'crm:customers:list', label: 'CRM-客户-查看', group: 'crm' }, CUSTOMER_CREATE: { code: 'crm:customers:create', label: 'CRM-客户-新建', group: 'crm' }, CUSTOMER_UPDATE: { code: 'crm:customers:update', label: 'CRM-客户-编辑', group: 'crm' }, CUSTOMER_DELETE: { code: 'crm:customers:delete', label: 'CRM-客户-删除', group: 'crm' }, CUSTOMER_DISPATCH: { code: 'crm:customers:dispatch', label: 'CRM-客户-派单', group: 'crm' },
  DISPATCH_LIST: { code: 'crm:dispatches:list', label: 'CRM-派单-查看', group: 'crm' }, DISPATCH_UPDATE: { code: 'crm:dispatches:update', label: 'CRM-派单-编辑', group: 'crm' }, DISPATCH_DELETE: { code: 'crm:dispatches:delete', label: 'CRM-派单-删除', group: 'crm' }, DISPATCH_REPLY: { code: 'crm:dispatches:reply', label: 'CRM-派单-回复', group: 'crm' }, DISPATCH_LOG: { code: 'crm:dispatches:log', label: 'CRM-派单-跟进', group: 'crm' },
  MEMBER_LIST: { code: 'crm:members:list', label: 'CRM-会员-查看', group: 'crm' }, MEMBER_CREATE: { code: 'crm:members:create', label: 'CRM-会员-新建', group: 'crm' }, MEMBER_UPDATE: { code: 'crm:members:update', label: 'CRM-会员-编辑', group: 'crm' }, MEMBER_DELETE: { code: 'crm:members:delete', label: 'CRM-会员-删除', group: 'crm' }, MEMBER_REMARK: { code: 'crm:members:remark', label: 'CRM-会员-备注', group: 'crm' },
} satisfies Record<string, PermissionRef>)
registerPermissions(...Object.values(PERMS))
export type CrmPermission = keyof typeof PERMS
