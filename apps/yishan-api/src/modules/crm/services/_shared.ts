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
