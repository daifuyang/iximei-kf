/**
 * 前端密码校验规则 —— 与后端 `apps/yishan-api/src/core/utils/password-policy.ts` 严格对齐。
 *
 * 任何新增的密码字段（注册 / 改密 / 重置 / 创建账号）都必须从这里取规则，
 * 不要在前端手写 minLength / pattern，否则会再次出现"前端 8 位、后端 6 位"之类的分叉。
 *
 * 大厂风格提示：每条规则单独 message，让用户一眼看出"为什么被拒"。
 * 长度与复杂度分开校验 —— 先长度后复杂度，避开"长度对了但复杂度不对"那种含糊提示。
 */

// ── 后端 PASSWORD_POLICY 的镜像（apps/yishan-api/src/core/utils/password-policy.ts） ──
//   minLength: 6
//   maxLength: 50
//   pattern  : /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]+$/

export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 50;

/** 字符集：字母 + 数字 + @$!%*?&。与后端保持一致。 */
export const PASSWORD_CHARS = '[a-zA-Z\\d@$!%*?&]';

/**
 * 完整正则（含长度锚定）。供 antd `pattern` 规则使用 —— 一旦命中任意一条规则即报错。
 * 注意：`pattern` 是"全字符串匹配"，所以 ^...$ 锚点是必需的。
 */
export const PASSWORD_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,50}$/;

/** 单独"复杂度"正则（不含长度），用于和长度规则组合做"先长度后复杂度"的清晰提示。 */
export const PASSWORD_COMPLEXITY_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]+$/;

/** 可复用的中文文案。所有密码相关提示从这里取，避免散落不一致。 */
export const PASSWORD_MESSAGES = {
  required: '请输入密码',
  minLength: `密码长度不能少于 ${PASSWORD_MIN} 位`,
  maxLength: `密码长度不能超过 ${PASSWORD_MAX} 位`,
  complexity: '密码必须包含字母和数字,只能使用字母、数字和 @$!%*?&',
  confirmMismatch: '两次输入的密码不一致',
} as const;

/**
 * 给 antd `Form.Item rules` 用的"标准密码规则数组"。
 * 用法:
 *   <Form.Item name="password" rules={passwordRules({ required: true })}>
 *     <Input.Password />
 *   </Form.Item>
 *
 * 默认行为：required + 长度（min/max）+ 复杂度，按 antd 顺序逐条校验，
 * 第一条不通过就停（validateFirst 由调用方决定是否开）。
 */
export interface PasswordRulesOptions {
  /** 是否必填，默认 false（用于"编辑时不传则保留"场景） */
  required?: boolean;
  /** 自定义必填提示 */
  requiredMessage?: string;
}

export function passwordRules(opts: PasswordRulesOptions = {}) {
  const rules: Array<Record<string, unknown>> = [];
  if (opts.required) {
    rules.push({ required: true, message: opts.requiredMessage ?? PASSWORD_MESSAGES.required });
  }
  // 长度优先 —— 大厂经验：用户最容易理解"长度不对"，先报长度能减少心智负担
  rules.push({
    min: PASSWORD_MIN,
    max: PASSWORD_MAX,
    message: `密码长度需为 ${PASSWORD_MIN}-${PASSWORD_MAX} 位`,
  });
  // 复杂度次之 —— 长度过了再看"是否含字母+数字+合法字符集"
  rules.push({
    pattern: PASSWORD_COMPLEXITY_PATTERN,
    message: PASSWORD_MESSAGES.complexity,
  });
  return rules;
}

/** 确认密码规则 —— 强依赖原密码字段做相等性校验 */
export function passwordConfirmRules(depsName: string) {
  return [
    { required: true, message: '请再次输入密码' },
    ({ getFieldValue }: { getFieldValue: (name: string) => unknown }) => ({
      validator(_: unknown, value: string) {
        if (!value || getFieldValue(depsName) === value) {
          return Promise.resolve();
        }
        return Promise.reject(new Error(PASSWORD_MESSAGES.confirmMismatch));
      },
    }),
  ];
}

/**
 * 密码强度（前端提示用，不影响校验）。
 * 返回 0-3: 0=弱 1=一般 2=良好 3=强
 * 仅在用户已开始输入时计算（避免空字符串给一个"弱"）。
 */
export function passwordStrength(pwd: string): 0 | 1 | 2 | 3 {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1; // 大小写都有
  if (/\d/.test(pwd) && /[^a-zA-Z\d]/.test(pwd)) score += 1; // 数字 + 特殊符号
  // 上限 3
  if (score > 3) return 3;
  return score as 0 | 1 | 2 | 3;
}

export const PASSWORD_STRENGTH_LABEL: Record<0 | 1 | 2 | 3, { text: string; color: string }> = {
  0: { text: '弱', color: '#ff4d4f' },
  1: { text: '一般', color: '#faad14' },
  2: { text: '良好', color: '#52c41a' },
  3: { text: '强', color: '#1677ff' },
};