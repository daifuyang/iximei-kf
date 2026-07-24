import sanitizeHtml from 'sanitize-html'
export const SUPER_ADMIN_ID=1
export const isSuperAdmin=(id:number)=>id===SUPER_ADMIN_ID
export const pageArgs=(q:any)=>({page:Math.max(1,Number(q.page??1)),pageSize:Math.max(0,Number(q.pageSize??10))})
export const asDate=(v:unknown)=>{if(!v)return undefined;const d=new Date(String(v));return Number.isNaN(d.getTime())?undefined:d}
export const compact=<T extends Record<string,unknown>>(v:T)=>Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined)) as T
export const sanitizeReplyContent=(content:string)=>sanitizeHtml(content,{allowedAttributes:{a:['href','target','rel'],img:['alt','src','title'],mark:['data-color'],p:['style'],span:['style']},allowedSchemes:['http','https','mailto'],allowedTags:['a','blockquote','br','code','em','h1','h2','h3','h4','img','li','mark','ol','p','pre','s','span','strong','sub','sup','u','ul']})
export const hasReplyContent=(content:string)=>/<img\b/i.test(content)||Boolean(sanitizeHtml(content,{allowedAttributes:{},allowedTags:[]}).replaceAll('&nbsp;',' ').trim())
export const sanitizeDispatchReplies=(dispatch:any)=>({...dispatch,replies:dispatch.replies?.map((r:any)=>({...r,content:sanitizeReplyContent(r.content)}))})
export function normalizeContractPhotos(v:unknown){if(v===undefined)return undefined;if(v===null||v==='')return null;if(typeof v==='string'){try{return JSON.parse(v)}catch{return [{url:v,name:''}]}}return v}
export const HOSPITAL_ACCOUNT_ROLES=['owner','admin','member'] as const
export function assertHospitalAccountRole(role:unknown):asserts role is (typeof HOSPITAL_ACCOUNT_ROLES)[number]{if(!HOSPITAL_ACCOUNT_ROLES.includes(role as any))throw new Error('无效的角色')}

/**
 * 全局查看权：sys_user.role.code ∈ { super_admin, admin } 视为看全部。
 * 其他角色只看到自己 ownerUserId 的数据行（典型：客服只看自己添加的会员顾客）。
 *
 * 接收 fastify 实例而不是 req——crm service 不依赖 fastify 类型，
 * 现成的 userRolesById 通过全局缓存映射传入。
 */
export type GlobalViewRoles =
  | 'super_admin'
  | 'admin'
  | 'normal_user'
  | 'hospital_account'
  | 'customer_service'

const FULL_VIEW_ROLE_CODES: ReadonlySet<GlobalViewRoles> = new Set<GlobalViewRoles>([
  'super_admin',
  'admin',
])

export const canViewAllData = (
  userId: number,
  roleCodes: ReadonlyArray<GlobalViewRoles>,
): boolean => {
  if (userId === SUPER_ADMIN_ID) return true
  return roleCodes.some((code) => FULL_VIEW_ROLE_CODES.has(code))
}

/** 提取 ownerUserId 的过滤条件：可见全部 → undefined；否则 → 当前用户 id */
export const ownerScopeOrCurrent = (
  userId: number,
  roleCodes: ReadonlyArray<GlobalViewRoles>,
): number | undefined => (canViewAllData(userId, roleCodes) ? undefined : userId)
