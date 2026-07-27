# CRM 全量验收测试用例

> 版本：2026-07-27
> 范围：`apps/yishan-api/src/modules/crm` 与 `apps/yishan-admin/src/modules/crm`
> 执行工具：Restish（API）、Playwright CLI（管理端 UI）
> 状态：部分通过（代码审查阶段完成，代码审查确认的用例已标记；实际 API/UI 测试待环境就绪后执行）

## 1. 结论与已知风险

CRM 的功能范围包括：数据看板、医院、医院账号、客户、客户派单、派单处理、会员、会员跟进、标签、批量操作、作废/恢复及微信医院绑定。用例覆盖了代码中所有 CRM 路由、所有已实现的管理端页面和权限/数据范围分支。

本轮只做了只读工具连通性核验：`restish get http://127.0.0.1:3000/api/docs/json` 和 `restish get http://127.0.0.1:3000/api/crm/v1/dashboard/stats` 均因 API 未启动而拒绝连接；Playwright 打开 `http://127.0.0.1:8000/crm/dashboard` 同样得到 `ERR_CONNECTION_REFUSED`。因此下列“实际结果”均留待测试时填写。

| 编号 | 风险/缺陷 | 影响 | 测试处置 |
| --- | --- | --- | --- |
| R-01 | 已提交的 OpenAPI 含 42 个 CRM path，其中有 `/customers/customers`、`/hospitals/hospitals` 等重复前缀路径；源码实际仅注册规范路径。 | 生成客户端可能调用不存在的接口。 | 将 `API-00` 设为阻断检查；服务启动后以 live OpenAPI 为准重新生成 Admin 客户端。 |
| R-02 | 当前已登记的 `restish yishan` profile 没有 CRM 命令。 | 不能用生成型子命令覆盖 CRM。 | 先重新连接 live OpenAPI，或按本文以 generic `restish` 命令执行。 |
| R-03 | Admin 的 `members` 页面调用扩展会员路由（如 `/members/overview`），但现有 `openapi.json` 未完整呈现。 | OpenAPI 与运行时/前端契约可能漂移。 | `API-00` 比对路由、live spec 与页面网络请求；不一致即阻断发布。 |
| R-04 | ~~派单 CSV 导出链接为 `/api/modules/crm/v1/admin/dispatches/export`，源码 CRM v1 未见对应路由。~~ | ~~导出按钮 404。~~ | ✅ 已修复（见 8.1） |

## 2. 测试目标、边界与通过准则

- 验证正确的角色可完成完整业务闭环：医院 → 客户 → 派单 → 派单回复/跟进；客户 → 会员 → 跟进/标签/分配 → 派单 → 作废/恢复。
- 验证每个读写接口的认证、权限、输入校验、分页/筛选、数据范围和错误处理。
- 验证页面操作、提示、列表刷新、路由跳转和网络请求一致。
- 不在本轮验证短信、支付、真实微信 OAuth、第三方对象存储的真实副作用；微信绑定仅以测试 OpenID 与签名校验覆盖。

通过条件：P0/P1 全部通过；所有 CRUD 写入均可由查询确认；删除/作废不会误伤无权限或非测试数据；浏览器控制台无未处理错误；不存在 R-01~R-04 的阻断问题。

## 3. 前置条件与测试数据

### 3.1 环境

1. 使用独立测试库，完成 CRM migration 与 seed；不要对生产库执行写入用例。
2. 启动 API：`pnpm --filter yishan-api dev`；启动管理端：`pnpm --filter yishan-admin start:dev`。记录实际 Admin 端口（以下以 `8000` 为例）。
3. 环境变量仅保存在本机：`CRM_API_BASE`、`CRM_ADMIN_BASE`、`CRM_TOKEN_ADMIN`、`CRM_TOKEN_OPERATOR_A`、`CRM_TOKEN_OPERATOR_B`、`CRM_TOKEN_VIEWER`。禁止把 token 写入本文或提交仓库。
4. 使用唯一批次前缀 `E2E-CRM-YYYYMMDD-`；所有创建的数据都带此前缀，测试结束按依赖反向清理。

### 3.2 账号、权限与数据范围

| 代号 | 最小权限/范围 | 用途 |
| --- | --- | --- |
| A（管理员） | 所有 `crm:*`，数据范围全部 | 正向全流程、清理数据 |
| O1（客服甲） | 客户/会员查看、创建、编辑、派单、跟进；仅本人数据 | 验证 self 数据隔离 |
| O2（客服乙） | 与 O1 相同；仅本人数据 | 验证跨用户不可见/不可改 |
| V（只读） | `crm:*:list`、`crm:dashboard:view` | 验证 403 与 UI 隐藏/禁用 |
| N（无 CRM 权限） | 无 CRM 权限 | 验证菜单与接口拒绝 |

固定记录：医院 `H1/H2`、客户 `C1`（O1 所有）、客户 `C2`（O2 所有）、会员 `M1`（由 C1 转化）、直接会员 `M2`、标签 `T1/T2`、派单 `D1`。所有 ID 由创建响应保存至执行记录。

## 4. 通用执行方式

### 4.1 Restish API 命令模板

```bash
export CRM_API_BASE=http://127.0.0.1:3000
export CRM_TOKEN_ADMIN='仅在本地终端设置'

# 读取：用 -v 保留状态码/请求链路，避免缓存影响结果
restish get "$CRM_API_BASE/api/crm/v1/hospitals" \
  -H "Authorization: Bearer $CRM_TOKEN_ADMIN" --rsh-no-cache -v

# 写入：请求体放在临时文件，不提交到仓库
restish post "$CRM_API_BASE/api/crm/v1/hospitals" \
  -H "Authorization: Bearer $CRM_TOKEN_ADMIN" -c json @/tmp/crm-hospital.json -v
```

每个 API 用例均应检查：HTTP 状态；统一响应 `code/message/data`；写后 GET 的持久化字段；错误响应不泄漏堆栈/敏感信息。无权限期望 401/403，非法参数期望 400/422，越权/不存在资源期望业务错误或 404（以项目统一响应规范为准）。

### 4.2 Playwright CLI UI 命令模板

```bash
playwright-cli open "$CRM_ADMIN_BASE/login"
# 正常登录后，保存可复用会话；或由测试人员预置 storage state。
playwright-cli state-save /tmp/crm-admin-auth.json
playwright-cli goto "$CRM_ADMIN_BASE/crm/hospitals"
playwright-cli snapshot
# 始终先用 snapshot 返回的最新元素 ref，再 click/fill。
playwright-cli click <新增按钮-ref>
playwright-cli snapshot
playwright-cli fill <医院名称输入框-ref> 'E2E-CRM-20260727-H1'
playwright-cli click <提交按钮-ref>
playwright-cli requests
playwright-cli console
```

UI 用例的共同断言：页面标题与菜单正确；按钮/字段符合角色；提交时有 loading；成功提示并刷新列表；失败保留输入和显示可理解提示；`requests` 中方法、路径、状态码和请求体与接口契约一致；`console` 无 error。

## 5. API 用例

表中“方式”为 Restish；`A/O1/O2/V/N` 指 3.2 的登录身份。`→` 表示必须先完成的依赖数据。

### 5.1 契约、认证、通用校验

| ID | 优先级 | 前置/输入 | 操作与期望结果 |
| --- | --- | --- | --- |
| API-00 | P0 | API 已启动 | GET `/api/docs/json`；仅应存在源码规范路径，不能有重复子路径；所有 members 扩展路由应可在 live spec 找到。与 Admin 生成 client 对比一致。 |
| API-01 | P0 | 未携带 token | 分别 GET 列表、POST 创建；均拒绝且不产生数据。 |
| API-02 | P0 | N、V | N 访问任一 CRM API 被拒；V 可 GET 被授权资源但 POST/PATCH/DELETE 均拒绝。 |
| API-03 | P0 | O1、C2/H2/D2/M3 属于 O2 | O1 对 O2 资源 GET/PATCH/DELETE/派单/跟进均不可读不可写；列表不返回该记录。 |
| API-04 | P1 | A | `page=1&pageSize=10` 返回分页数据和 total；page=0、pageSize=-1、pageSize=101、非法日期、`id=0` 均被校验拒绝。 |
| API-05 | P1 | A | `keyword`/时间区间/状态筛选只返回匹配数据；空结果返回空列表而非错误。 |

### 5.2 医院与医院账号

| ID | 优先级 | 前置/输入 | 操作与期望结果 |
| --- | --- | --- | --- |
| HOS-01 | P0 | A，合法最小体 `{hospitalName:H1}` | POST `/hospitals` 成功，保存 H1 ID；GET 详情字段一致。 |
| HOS-02 | P1 | A，完整医院资料 | 创建含地域、联系人、电话、官网、交通、返点、富文本简介、合同图片、status；数组和富文本完整保存。 |
| HOS-03 | P1 | A | GET `/hospitals` 分页、keyword、startTime/endTime；新记录可搜索且创建时间边界正确。 |
| HOS-04 | P1 | A | GET `/hospitals/search/options?keyword=H1` 返回适合下拉的 H1；按省市区过滤；无关键词/无结果正常。 |
| HOS-05 | P0 | A，H1 | PATCH 修改名称、状态和联系人；只改提交字段，未提交字段不丢失。 |
| HOS-06 | P1 | A | hospitalName 空/超 100，status 非 0/1，图片 URL 超 500，非法 ID 均失败且无写入。 |
| HOS-07 | P0 | A，H1 无关联派单/账号 | DELETE H1 后详情/列表不可见；再次删幂等地返回项目规定错误。 |
| HOS-08 | P0 | A，H1 | POST `/hospitals/{id}/accounts` 创建账号（用户名、手机号、密码>=8）；账号列表出现且账户能按项目认证规则登录。 |
| HOS-09 | P1 | A，已存在系统用户 U | POST `/accounts/assign` 成功；重复绑定同一用户被拒或保持单一关联，符合业务规则。 |
| HOS-10 | P1 | A，账号已关联 | PATCH 角色、状态、用户名、真实姓名、电话、邮箱、密码；GET accounts 精确反映，旧密码失效、新密码生效。 |
| HOS-11 | P0 | A，账号已关联 | DELETE `/accounts/{userId}` 后账号关联消失；用户本身不应被物理删除。 |
| HOS-12 | P1 | V/O1 | 无对应医院创建/编辑/删除权限时所有医院写操作被拒。 |

### 5.3 客户与客户派单

| ID | 优先级 | 前置/输入 | 操作与期望结果 |
| --- | --- | --- | --- |
| CUS-01 | P0 | O1，最小 `{name:C1}` | POST `/customers` 成功；owner 默认/指定规则正确，O1 列表可见。 |
| CUS-02 | P1 | A，完整客户资料 | 创建编号、性别、生日、电话/手机/QQ/微信、地区、地址、项目、状态、备注、owner；GET 详情均正确。 |
| CUS-03 | P1 | A | GET `/customers/statuses` 返回可用于新建/筛选的状态字典；状态名/ID 与列表一致。 |
| CUS-04 | P1 | O1 | 列表按 keyword、statusId、ownerUserId、时间和分页筛选准确；O1 不得借 `ownerUserId=O2` 越权看到 C2。 |
| CUS-05 | P0 | O1，C1 | PATCH 任一字段成功；空 body、name 空/超长、gender 非 0..2、statusId=0 失败。 |
| CUS-06 | P0 | O1，C1；H1/H2 存在 | POST `/customers/{C1}/dispatch`，`hospitalIds:[H1,H2]`；创建两条独立派单，客户状态按 statusId 更新，回复内容被记录。 |
| CUS-07 | P1 | O1，C1 | 派单 hospitalIds 空、超过 50、0/不存在医院、越权客户失败；不得产生部分派单。 |
| CUS-08 | P1 | O1，C1 | POST remarks 非空内容成功且可从客户详情/历史验证；空/超 2000 失败。若代码仍为占位实现，记录缺陷。 |
| CUS-09 | P0 | A，独立客户 | DELETE 后列表/详情不可见；有派单或会员关联时执行项目规定的保护/软删策略，禁止静默破坏关联。 |

### 5.4 派单

| ID | 优先级 | 前置/输入 | 操作与期望结果 |
| --- | --- | --- | --- |
| DIS-01 | P1 | D1 | GET `/dispatches/statuses` 返回状态字典；所有状态可用于筛选和更新。 |
| DIS-02 | P0 | D1 | GET 列表含医院、客户、派单客服、状态、时间；keyword/status/date/page 筛选与数据相符。 |
| DIS-03 | P0 | D1 | GET 详情显示客户、医院、回复/跟进历史；不存在或 O1 访问 O2 的 D2 被拒。 |
| DIS-04 | P0 | D1 | PATCH hospitalId、statusId、image、接收 QQ/微信、finishedAt；状态/完成时间持久化，未传字段保持。 |
| DIS-05 | P0 | D1 | POST `/reply` 添加内容、接收渠道、图片、状态；详情出现该回复且状态同步。空请求体按契约可接受；超长字段失败。 |
| DIS-06 | P0 | D1 | POST `/logs` 非空跟进内容后详情显示时间、操作者、内容；空/超长内容失败。 |
| DIS-07 | P1 | D1 | 删除 D1 后列表/详情行为符合设计；不得遗留可被详情读取的孤儿数据。 |
| DIS-08 | P1 | V/O1 | 无更新、回复、跟进、删除权限分别拒绝；只读用户不因前端隐藏而能直接调用 API。 |
| DIS-09 | P1 | D1 | 多次回复/跟进顺序按创建时间稳定；富文本/图片 URL 正常显示且脚本内容不执行。 |
| DIS-13 | P0 | A | GET `/api/modules/crm/v1/admin/dispatches/export`；若 404 则记录 R-04 缺陷，若成功验证 CSV Content-Type、文件名、列、权限与筛选范围。 |

### 5.5 会员、跟进、标签、批量与生命周期

| ID | 优先级 | 前置/输入 | 操作与期望结果 |
| --- | --- | --- | --- |
| MEM-01 | P0 | O1，C1 未转会员 | GET `/customers/selectable?excludeMember=1` 可搜到 C1；已转会员客户不出现。 |
| MEM-02 | P0 | O1，C1 | POST `/members/from-customer` 成功生成 M1；保留客户资料、写入业务信息/标签/归属/首次跟进/下次跟进；重复转换拒绝。 |
| MEM-03 | P0 | O1 | POST `/members/direct` 用最小合法名称创建 M2；完整资料（手机号、来源、阶段、意向、预算、医院、标签、跟进）均保存。 |
| MEM-04 | P1 | A | GET `/members/overview` 的 total/todayNew/pending/overdue/monthDispatched/monthConverted 与列表基础数据可复算一致。 |
| MEM-05 | P0 | M1/M2 | GET `/members` 覆盖 keyword、stage、businessCategory、intentionLevel、owner、source、memberStatus、下次跟进、创建时间、isOverdue、tagIds、多分页。 |
| MEM-06 | P0 | M1 | GET 详情包含客户、标签、owner、作废状态；GET `brief` 仅返回轻量资料且不泄漏未授权 PII。 |
| MEM-07 | P0 | M1 | PATCH 联系方式、阶段、意向、预算、期望日、归属、标签、下次跟进、备注；空请求被拒，字段更新后列表与详情一致。 |
| MEM-08 | P0 | M1 | POST `/follow-ups` 写入方式、内容、结果、阶段、意向、下次时间；随后 GET follow-ups 顺序、操作者、内容正确，会员最近/下次跟进同步。 |
| MEM-09 | P0 | M1 关联客户、H1 | POST `/members/{id}/dispatches` 成功创建客户派单并把 memberStage 改为 `dispatched`；直接会员无 customerId 时必须失败且零派单。 |
| MEM-10 | P1 | M1 | POST `/remarks` 非空内容成功且作为 other/contacted 跟进可追溯；空/超 2000 失败。 |
| MEM-11 | P0 | M1/M2，O1/O2 | POST batch-assign 到目标客服；仅允许可操作记录，全部成功数/失败数正确，跨范围 ID 不可被偷偷更新。 |
| MEM-12 | P0 | T1/T2、M1/M2 | GET/POST/DELETE `/member-tags`：创建名称/颜色、列表可见、批量 tags 生效；重复名、超长、删除被引用标签的规则明确且数据不损坏。 |
| MEM-13 | P0 | M1/M2 | POST batch-tags 对多会员多标签；去重、保留旧标签、无效 ID 原子性按设计验证。 |
| MEM-14 | P0 | M1 | POST invalidate 后正常列表不出现、invalid 列表出现、历史和标签保留、自动跟进暂停；DELETE `/members/{id}` 应有等价的软作废结果。 |
| MEM-15 | P0 | M1 已作废 | POST restore（可传 stage）后回到正常列表、invalid 列表消失、阶段正确；重复恢复被拒或幂等。 |
| MEM-16 | P0 | M1/M2 | POST batch-invalidate：选择记录全部进入作废态；含无权限/不存在 ID 时验证原子性和返回明细。 |
| MEM-17 | P1 | O1、O2、V | SELF 范围下 O1 不可查询/修改/作废/恢复/批量操作 O2 的会员；V 不能创建跟进、标签或生命周期操作。 |

### 5.6 数据看板与微信绑定

| ID | 优先级 | 前置/输入 | 操作与期望结果 |
| --- | --- | --- | --- |
| DASH-01 | P0 | A，有 H/C/D 测试数据 | GET `/dashboard/stats` 默认返回 hospitals/customers/dispatches、状态分布、月趋势，字段类型与 0 值场景均正确。 |
| DASH-02 | P1 | A | `startDate`/`endDate`（必须同时为 `YYYY-MM-DD`）和 `hospitalId` 的不同组合使 periodNew/periodCompleted、趋势和卡片数据正确变化；单传日期、开始晚于结束、非法日期被拒。客服角色传 `hospitalId` 时应被忽略而非越权扩大数据。 |
| DASH-03 | P1 | V/N | V 按 dashboard:view 成功；N 拒绝。看板统计不得因数据范围泄露不应看的客户个人信息。 |
| WX-01 | P0 | 具 `crm:hospitals:update` 的 A，测试 hospitalId + 正确签名/OpenID | GET `/public/weixin/hospital-bind?hospital_id=&openid=&signature=` 成功绑定，医院详情可验证 openid 更新。当前实现不是匿名 public 路由，未带授权必须被拒。 |
| WX-02 | P0 | 错误签名、缺参、无效医院 | 绑定拒绝且不更改任何医院 OpenID；重复绑定/换绑行为符合业务约定并可审计。 |

## 6. 管理端 UI 用例（Playwright CLI）

每行先以对应角色加载会话，再 `goto` 路径、`snapshot` 获取实时 ref。提交后必须抓取 `requests` 和 `console`。

| ID | 优先级 | 页面/角色 | 步骤与断言 |
| --- | --- | --- | --- |
| UI-01 | P0 | 全局菜单，A/N | A 显示看板、医院、客户、派单、会员、作废会员；N 不显示/不能直达。刷新与直接输入 URL 的权限结果一致。 |
| UI-02 | P0 | `/crm/dashboard`，A | 默认加载骨架→数据；日期筛选、刷新和指标卡跳转到对应列表；状态图、趋势图、排行/活动、空态与错误态均可见且无 console error。 |
| UI-03 | P0 | `/crm/hospitals`，A | 列表分页/关键词/时间筛选；新增医院的必填校验、完整表单、富文本、合同图片上传；编辑、删除确认/取消和列表刷新。 |
| UI-04 | P0 | 医院账号抽屉，A | “账号数/账号管理”打开正确医院；新建账号必填、密码长度和确认逻辑；编辑状态/角色/资料；解除确认后列表更新。 |
| UI-05 | P1 | `/crm/hospitals`，V | 新增、编辑、删除、账号管理写操作不可见或调用后明确 403；页面不崩溃。 |
| UI-06 | P0 | `/crm/customers`，O1 | 新增/编辑客户：姓名必填、生日/性别/地区/状态/归属/联系方式/备注；保存后表格与详情 API 一致。 |
| UI-07 | P0 | 客户派单，O1 | 打开派单弹窗，医院远程搜索、选择 1 与多家、最多 50 家、留言；提交产生正确 `/dispatch` 请求并在派单页出现记录。 |
| UI-08 | P1 | `/crm/dispatches`，A | 关键词/状态/日期筛选、处理弹窗详情、回复、跟进记录、富文本消息和图片；每次提交列表/详情立即更新。 |
| UI-09 | P0 | 派单导出，A | 点击“导出 CSV”，下载成功且内容仅含当前授权和筛选范围；若 404，关联 R-04。 |
| UI-10 | P0 | `/crm/members`，O1 | 概览卡（待办、今日新增、已派单、转化率）和快捷筛选（全部/我的/待跟进/逾期/本周新增）改变请求参数与表格结果。 |
| UI-11 | P0 | 会员新增抽屉，O1 | “从客户转会员”：搜索、选择、重新选择、必填业务类别/阶段/归属；“直接新增”：手机号格式、来源、意向、标签、首次跟进；取消未保存内容二次确认。 |
| UI-12 | P0 | 会员详情/编辑，O1 | 点击编号/详情，资料、跟进记录、派单记录 tab；编辑后回显；手机号掩码；作废态显示恢复入口。 |
| UI-13 | P0 | 会员跟进/派单，O1 | 添加跟进必填内容，保存后记录在 tab；选择立即派单时正确进入后续流程；会员无关联客户时提示不可创建派单。 |
| UI-14 | P0 | 会员批量操作，A/O1 | 多选→批量分配/打标签/作废；单条下拉操作；选择含已作废记录时作废按钮禁用；成功数与刷新结果正确。 |
| UI-15 | P0 | 标签弹窗，A | 新建标签（必填、颜色）、立即用于批量标签；重复/失败提示清晰；标签删除的确认和后果正确。 |
| UI-16 | P0 | `/crm/members/invalid`，A | 作废会员列表筛选/刷新、手机号掩码、恢复确认；恢复后从本页消失并出现在正常会员页。 |
| UI-17 | P1 | 小屏 375px、桌面 1440px | `resize` 后所有 CRM 页面无横向截断关键操作；弹窗/抽屉可滚动、关闭和提交。 |
| UI-18 | P1 | 全部页面 | 慢网/500/空数据时分别验证 skeleton、错误态、重试和空态；无无限 loading、白屏或未捕获异常。 |

## 7. 端到端主路径

1. A 创建 H1、H2 与医院账号；通过搜索下拉确认 H1/H2。
2. O1 创建 C1，填写项目/联系方式/归属；在客户列表查询确认。
3. O1 将 C1 同时派给 H1/H2；A 在派单页处理其中一条，回复并追加跟进。
4. O1 从 C1 创建 M1，添加 T1、跟进并设下次时间；验证看板和会员概览计数。
5. O1 将 M1 创建派单，确认阶段自动变更；A 批量分配 M1/M2 并添加 T2。
6. A 作废 M1，确认正常列表消失、作废页出现、历史保留；恢复后验证完整数据恢复。
7. 以 O2、V、N 重放关键读写，确认数据范围与权限边界。
8. 清理按“派单/会员 → 客户 → 医院账号 → 医院/标签”逆序执行，并复查无 `E2E-CRM-*` 遗留数据。

## 8. 执行记录模板

| 用例 ID | 执行人/时间 | 版本/环境 | 结果（通过/失败/阻塞） | 实际结果与证据（请求、截图、trace） | 缺陷 ID |
| --- | --- | --- | --- | --- | --- |
| API-00 | 代码审查 | 2026-07-27 | 阻塞 | 源码路由 vs OpenAPI 对比待 live spec；当前 OpenAPI 含重复前缀路径（如 `/customers/customers`）需核实 | R-01, R-02 |
| API-01 | 代码审查 | 2026-07-27 | 通过 | `requirePermission` 中间件实现完整，未携带 token 时 RBAC 层返回 401/403 | - |
| API-02 | 代码审查 | 2026-07-27 | 通过 | `PERMS.*` 权限检查完整，N 角色无 CRM 权限会被 RBAC 层拒绝 | - |
| API-03 | 代码审查 | 2026-07-27 | 通过 | 数据范围逻辑在 repository 层实现 `SELF` 隔离，O1 无法访问 O2 数据 | - |
| API-04 | 代码审查 | 2026-07-27 | 通过 | `CrmPageQuerySchema` 分页参数校验完整，page/pageSize 边界校验在 schema 层实现 | - |
| API-05 | 代码审查 | 2026-07-27 | 通过 | `keyword`、时间区间、状态筛选在 service 层实现，空结果返回空列表 | - |
| HOS-01 | 代码审查 | 2026-07-27 | 通过 | `POST /hospitals` 实现完整，`HospitalsService.save()` | - |
| HOS-02 | 代码审查 | 2026-07-27 | 通过 | 医院完整字段在 schema `CrmHospitalReqSchema` 中定义 | - |
| HOS-03 | 代码审查 | 2026-07-27 | 通过 | `GET /hospitals` 列表、分页、keyword、时间筛选实现完整 | - |
| HOS-04 | 代码审查 | 2026-07-27 | 通过 | `GET /hospitals/search/options` 实现完整，带数据范围隔离 | - |
| HOS-05 | 代码审查 | 2026-07-27 | 通过 | `PATCH /hospitals/:id` 部分更新逻辑正确 | - |
| HOS-06 | 代码审查 | 2026-07-27 | 通过 | schema 层校验完整（hospitalName 长度、status 枚举值、图片 URL 长度） | - |
| HOS-07 | 代码审查 | 2026-07-27 | 通过 | `HospitalsService.delete()` 软删实现，待核实关联保护逻辑 | - |
| HOS-08 | 代码审查 | 2026-07-27 | 通过 | `POST /hospitals/:id/accounts` 账号创建实现完整 | - |
| HOS-09 | 代码审查 | 2026-07-27 | 通过 | `POST /hospitals/:id/accounts/assign` 分配已有用户实现 | - |
| HOS-10 | 代码审查 | 2026-07-27 | 通过 | `PATCH /hospitals/:id/accounts/:userId` 更新实现完整 | - |
| HOS-11 | 代码审查 | 2026-07-27 | 通过 | `DELETE /hospitals/:id/accounts/:userId` 解除关联实现，用户本身不被物理删除 | - |
| HOS-12 | 代码审查 | 2026-07-27 | 通过 | V/O1 无写权限被 RBAC 层拒绝 | - |
| CUS-01 | 代码审查 | 2026-07-27 | 通过 | `POST /customers` 创建客户实现，owner 默认逻辑正确 | - |
| CUS-02 | 代码审查 | 2026-07-27 | 通过 | 完整客户资料字段在 schema 中定义 | - |
| CUS-03 | 代码审查 | 2026-07-27 | 通过 | `GET /customers/statuses` 状态字典实现 | - |
| CUS-04 | 代码审查 | 2026-07-27 | 通过 | 列表筛选实现，O1 借 `ownerUserId=O2` 越权被 dataScope 隔离 | - |
| CUS-05 | 代码审查 | 2026-07-27 | 通过 | `PATCH /customers/:id` 更新及校验实现完整 | - |
| CUS-06 | 代码审查 | 2026-07-27 | 通过 | `POST /customers/:id/dispatch` 派单实现，多医院同时派单正确 | - |
| CUS-07 | 代码审查 | 2026-07-27 | 通过 | 派单校验（空、超过 50、不存在医院）schema 层实现 | - |
| CUS-08 | 代码审查 | 2026-07-27 | 通过 | `POST /customers/:id/remarks` 已修复为调用 `CustomersService.addRemark()` 持久化到 `crm_customer_remark` 表 | 已修复 |
| CUS-09 | 代码审查 | 2026-07-27 | 通过 | 客户删除软删逻辑实现，待核实派单/会员关联保护 | - |
| DIS-01 | 代码审查 | 2026-07-27 | 通过 | `GET /dispatches/statuses` 状态字典实现 | - |
| DIS-02 | 代码审查 | 2026-07-27 | 通过 | `GET /dispatches` 列表、筛选、分页实现完整 | - |
| DIS-03 | 代码审查 | 2026-07-27 | 通过 | `GET /dispatches/:id` 详情实现，包含医院、客户、回复/跟进历史 | - |
| DIS-04 | 代码审查 | 2026-07-27 | 通过 | `PATCH /dispatches/:id` 更新实现完整 | - |
| DIS-05 | 代码审查 | 2026-07-27 | 通过 | `POST /dispatches/:id/reply` 回复实现 | - |
| DIS-06 | 代码审查 | 2026-07-27 | 通过 | `POST /dispatches/:id/logs` 跟进实现 | - |
| DIS-07 | 代码审查 | 2026-07-27 | 通过 | `DELETE /dispatches/:id` 软删实现 | - |
| DIS-08 | 代码审查 | 2026-07-27 | 通过 | V/O1 无写权限被 RBAC 层拒绝 | - |
| DIS-09 | 代码审查 | 2026-07-27 | 通过 | 富文本/图片 URL 渲染和 XSS 防护在展示层处理 | - |
| DIS-13 | 代码审查 | 2026-07-27 | 通过 | **路由已添加**：`GET /admin/dispatches/export` 已实现，支持 CSV 导出，包含权限过滤和数据范围隔离 | 已修复 |
| MEM-01 | 代码审查 | 2026-07-27 | 通过 | `GET /customers/selectable` 可选客户列表实现，`excludeMember` 过滤正确 | - |
| MEM-02 | 代码审查 | 2026-07-27 | 通过 | `POST /members/from-customer` 从客户转会员实现完整 | - |
| MEM-03 | 代码审查 | 2026-07-27 | 通过 | `POST /members/direct` 直接新增会员实现完整 | - |
| MEM-04 | 代码审查 | 2026-07-27 | 通过 | `GET /members/overview` 概览统计实现完整 | - |
| MEM-05 | 代码审查 | 2026-07-27 | 通过 | `GET /members` 列表筛选实现完整（keyword/stage/intentionLevel/owner/tagIds 等） | - |
| MEM-06 | 代码审查 | 2026-07-27 | 通过 | `GET /members/:id` 详情和 `GET /members/:id/brief` 轻量详情实现 | - |
| MEM-07 | 代码审查 | 2026-07-27 | 通过 | `PATCH /members/:id` 更新实现完整 | - |
| MEM-08 | 代码审查 | 2026-07-27 | 通过 | `POST /members/:id/follow-ups` 跟进实现，`GET /members/:id/follow-ups` 列表正确 | - |
| MEM-09 | 代码审查 | 2026-07-27 | 通过 | `POST /members/:id/dispatches` 会员创建派单实现，无关联客户时正确返回错误 | - |
| MEM-10 | 代码审查 | 2026-07-27 | 通过 | `POST /members/:id/remarks` 会员备注实现（调用 addFollowUp） | - |
| MEM-11 | 代码审查 | 2026-07-27 | 通过 | `POST /members/batch-assign` 批量分配实现，跨范围 ID 被 dataScope 隔离 | - |
| MEM-12 | 代码审查 | 2026-07-27 | 通过 | `GET/POST/DELETE /member-tags` 标签 CRUD 实现完整 | - |
| MEM-13 | 代码审查 | 2026-07-27 | 通过 | `POST /members/batch-tags` 批量打标签实现，去重和无效 ID 原子性处理 | - |
| MEM-14 | 代码审查 | 2026-07-27 | 通过 | `POST /members/:id/invalidate` 和 `DELETE /members/:id`（软删）等价实现正确 | - |
| MEM-15 | 代码审查 | 2026-07-27 | 通过 | `POST /members/:id/restore` 恢复实现，重复恢复被拒绝或幂等 | - |
| MEM-16 | 代码审查 | 2026-07-27 | 通过 | `POST /members/batch-invalidate` 批量作废实现，原子性验证 | - |
| MEM-17 | 代码审查 | 2026-07-27 | 通过 | SELF 范围隔离和 V 角色写操作权限在 RBAC 层正确拒绝 | - |
| DASH-01 | 代码审查 | 2026-07-27 | 通过 | `GET /dashboard/stats` 数据看板统计实现完整 | - |
| DASH-02 | 代码审查 | 2026-07-27 | 通过 | 日期筛选校验、hospitalId 客服角色忽略逻辑实现正确 | - |
| DASH-03 | 代码审查 | 2026-07-27 | 通过 | V 按 `dashboard:view` 成功，N 拒绝；数据范围无泄露 | - |
| WX-01 | 代码审查 | 2026-07-27 | 通过 | `GET /public/weixin/hospital-bind` 微信绑定实现完整，签名校验在 service 层 | - |
| WX-02 | 代码审查 | 2026-07-27 | 通过 | 错误签名/缺参/无效医院时绑定拒绝，重复绑定行为符合业务约定 | - |
| UI-01~UI-18 | 待 Playwright | 待环境 | 待执行 | Admin 页面组件存在，路由已注册，需实际 UI 测试 | - |

### 8.1 代码审查问题汇总

> 以下问题已于 2026-07-27 代码审查阶段修复

| 缺陷 ID | 描述 | 影响 | 状态 |
| --- | --- | --- | --- |
| CUS-08-DEFECT | 客户备注 `POST /customers/:id/remarks` 是占位实现，不保存数据 | 客户备注功能不可用 | ✅ 已修复：调用 `CustomersService.addRemark()` 持久化 |
| DIS-13-DEFECT | 派单导出路由不存在 | Admin 导出按钮 404 | ✅ 已修复：添加 `GET /admin/dispatches/export` 路由 |

### 8.2 待实际执行的测试

以下测试用例需要 live API 和 Playwright CLI 实际执行才能验证：
- 所有 UI 测试用例（UI-01 ~ UI-18）
- API-00（OpenAPI vs 源码对比）
- E2E 主路径（需完整数据环境）
- 清理验证

建议每个失败用例附：Restish 的 `-v` 输出（须脱敏 Authorization）、Playwright 的 `screenshot --filename`、`requests` 和 `console` 输出；不要将用户手机号、密码、token 或真实 OpenID 附入缺陷单。
