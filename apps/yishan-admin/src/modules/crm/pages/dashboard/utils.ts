/**
 * 数据看板 — 工具函数
 *
 * 数据适配层：所有接口数据先经过这里，再传给 UI 组件。
 * 不修改后端接口，在前端建立统一的数据口径。
 */

import type {
  BusinessInsight,
  DashboardStats,
  FunnelStage,
  HospitalRankingItem,
  MetricItem,
  RecentActivity,
  StatusItem,
} from './types';

/* ──────── 数字格式化 ──────── */

/** 千分位格式化：21386 → "21,386" */
export function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '--';
  return Number(n).toLocaleString('zh-CN');
}

/** 安全除法，返回 0-100 的数值 */
export function safeDivide(a: number, b: number): number {
  if (b === 0 || a == null || b == null || Number.isNaN(a) || Number.isNaN(b))
    return 0;
  return (a / b) * 100;
}

/**
 * 百分比格式化
 * - 100% 显示为 "100%"
 * - 小于 0.1% 显示为 "<0.1%"
 * - 保留 1 位小数
 */
export function formatPercent(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '--';
  if (n === 0) return '0%';
  if (n === 100) return '100%';
  if (n < 0.1) return '<0.1%';
  if (n > 99.9 && n < 100) return '99.9%';
  return `${n.toFixed(1)}%`;
}

/* ──────── 环比计算 ──────── */

/**
 * 从月度趋势数据中计算环比
 * @returns { value: 环比百分比(正=上升), label: 描述文字 }
 */
export function calcMonthOverMonth(
  trend: { month: string; count: number }[],
): { value: number; label: string } | undefined {
  if (!trend || trend.length < 2) return undefined;
  const curr = trend[trend.length - 1]?.count ?? 0;
  const prev = trend[trend.length - 2]?.count ?? 0;
  if (prev === 0) return undefined;
  const pct = ((curr - prev) / prev) * 100;
  return {
    value: Math.abs(pct),
    label:
      pct >= 0 ? `较上月 +${pct.toFixed(1)}%` : `较上月 ${pct.toFixed(1)}%`,
  };
}

/* ──────── 指标卡数据构建 ──────── */

export function buildMetrics(
  stats: DashboardStats,
  /** 是否使用非默认近 12 月的统计周期 */
  hasPeriodFilter?: boolean,
): MetricItem[] {
  const { hospitals, customers, dispatches } = stats;

  const customerTrend = stats.monthlyTrend.customers;
  const dispatchTrend = stats.monthlyTrend.dispatches;

  const periodLabel = hasPeriodFilter ? '本期新增' : '本月新增';
  const totalLabel = hasPeriodFilter ? '累计总数' : '系统总数';

  return [
    {
      key: 'hospitals',
      title: hasPeriodFilter ? '本期新增医院' : '医院总数',
      tooltip: hasPeriodFilter
        ? '筛选期间内新录入的医院数量'
        : '系统中所有已录入的医院数量',
      value: hasPeriodFilter ? hospitals.periodNew : hospitals.total,
      suffix: '家',
      // 医院暂无独立趋势数据，不展示环比
      extra: {
        label: hasPeriodFilter ? totalLabel : periodLabel,
        value: hasPeriodFilter ? hospitals.total : hospitals.periodNew,
      },
      link: '/crm/hospitals',
    },
    {
      key: 'customers',
      title: hasPeriodFilter ? '本期新增客户' : '客户总数',
      tooltip: hasPeriodFilter
        ? '筛选期间内新录入的客户数量'
        : '系统中所有已录入的客户数量',
      value: hasPeriodFilter ? customers.periodNew : customers.total,
      suffix: '人',
      trend: hasPeriodFilter
        ? undefined
        : (() => {
            const mom = calcMonthOverMonth(customerTrend);
            return mom ? { ...mom, positive: true } : undefined;
          })(),
      extra: {
        label: hasPeriodFilter ? totalLabel : periodLabel,
        value: hasPeriodFilter ? customers.total : customers.periodNew,
      },
      link: '/crm/customers',
    },
    {
      key: 'dispatches',
      title: hasPeriodFilter ? '本期派单' : '本月派单',
      tooltip: hasPeriodFilter
        ? '筛选期间内已创建的派单数量'
        : '本月已创建的派单数量',
      value: dispatches.periodNew,
      suffix: '单',
      trend: hasPeriodFilter
        ? undefined
        : (() => {
            const mom = calcMonthOverMonth(dispatchTrend);
            return mom ? { ...mom, positive: true } : undefined;
          })(),
      extra: {
        label: '累计派单',
        value: dispatches.total,
      },
      link: '/crm/dispatches',
    },
    {
      key: 'completed',
      title: hasPeriodFilter ? '本期完成量' : '本月完成量',
      tooltip: hasPeriodFilter
        ? '筛选期间内完成的派单数量（含此前创建的派单）'
        : '本月内完成的派单数量（含此前月份创建的派单）',
      value: dispatches.periodCompleted,
      suffix: '单',
      extra: {
        label: '累计派单',
        value: dispatches.total,
      },
      link: '/crm/dispatches',
    },
  ];
}

/* ──────── 客户状态结构（存量） ──────── */

/**
 * 构建客户状态结构（存量），非严格转化漏斗。
 *
 * 口径说明：
 * - 客户录入 = customers.total（全量客户人数）
 * - 已派单    = 从 customerByStatus 提取"已派单"状态的人数
 * - 已到院    = 从 customerByStatus 提取"已到院"状态的人数
 * - 已成交    = 从 customerByStatus 提取"已手术"/"已成交"状态的人数
 *
 * 注意：各阶段为客户当前所处状态，不是按时间顺序的阶段转化。
 * 当客户状态分布中缺少对应状态时，该阶段数值为 0。
 * 派单单量与客户人数口径不同，不在同一结构中混用。
 */
export function buildFunnelStages(stats: DashboardStats): FunnelStage[] {
  const { total: totalCustomers } = stats.customers;
  const { customerByStatus } = stats;

  const findCount = (...names: string[]): number =>
    names.reduce(
      (sum, name) =>
        sum + (customerByStatus.find((s) => s.name.includes(name))?.count ?? 0),
      0,
    );

  const dispatchedCount = findCount('已派单');
  const arrivedCount = findCount('已到院');
  const doneCount = findCount('已手术', '已成交');

  const stages: FunnelStage[] = [
    {
      label: '客户录入',
      value: totalCustomers,
      unit: '人',
      cumulativeRate: totalCustomers > 0 ? 100 : null,
      stageRate: null,
    },
    {
      label: '已派单',
      value: dispatchedCount,
      unit: '人',
      cumulativeRate:
        totalCustomers > 0 ? safeDivide(dispatchedCount, totalCustomers) : null,
      stageRate:
        totalCustomers > 0 ? safeDivide(dispatchedCount, totalCustomers) : null,
    },
    {
      label: '已到院',
      value: arrivedCount,
      unit: '人',
      cumulativeRate:
        totalCustomers > 0 ? safeDivide(arrivedCount, totalCustomers) : null,
      stageRate:
        dispatchedCount > 0 ? safeDivide(arrivedCount, dispatchedCount) : null,
    },
    {
      label: '已成交',
      value: doneCount,
      unit: '人',
      cumulativeRate:
        totalCustomers > 0 ? safeDivide(doneCount, totalCustomers) : null,
      stageRate: arrivedCount > 0 ? safeDivide(doneCount, arrivedCount) : null,
    },
  ];

  // 验证：阶段数量不得大于前一阶段
  for (let i = 1; i < stages.length; i++) {
    if (stages[i].value > stages[i - 1].value) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[Dashboard] 漏斗数据异常：${stages[i].label}(${stages[i].value}) > ${stages[i - 1].label}(${stages[i - 1].value})，阶段转化率将不计算`,
        );
      }
      stages[i].stageRate = null;
    }
  }

  return stages;
}

/* ──────── 经营洞察 ──────── */

export function generateInsights(stats: DashboardStats): BusinessInsight[] {
  const insights: BusinessInsight[] = [];
  const { hospitals, customers, customerByStatus } = stats;

  const totalCustomers = customers.total;

  // 1. 新增客户趋势
  const trend = stats.monthlyTrend.customers;
  const last3 = trend.slice(-3);
  let consecutiveDown = 0;
  for (let i = 1; i < last3.length; i++) {
    if (last3[i].count < last3[i - 1].count) consecutiveDown++;
  }

  if (consecutiveDown >= 2) {
    const prev = last3[last3.length - 2]?.count ?? 0;
    const curr = last3[last3.length - 1]?.count ?? 0;
    const pct = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
    insights.push({
      id: 'customer-decline',
      type: 'error',
      title: '新增客户连续下降',
      content: `近 3 个月新增客户持续下降，本月环比 ${pct.toFixed(1)}%。建议检查渠道投放效果和客户导入流程。`,
      actionText: '查看客户数据',
      actionLink: '/crm/customers',
    });
  } else if (last3.length >= 2) {
    const prev = last3[last3.length - 2]?.count ?? 0;
    const curr = last3[last3.length - 1]?.count ?? 0;
    if (curr >= prev) {
      insights.push({
        id: 'customer-growth',
        type: 'success',
        title: '客户增长趋势良好',
        content: `近 3 个月新增客户保持增长，本期新增 ${customers.periodNew} 人。建议维持当前获客策略。`,
        actionText: '查看客户数据',
        actionLink: '/crm/customers',
      });
    }
  }

  // 2. 供需匹配
  if (hospitals.total > 0 && totalCustomers > 0) {
    const ratio = totalCustomers / hospitals.total;
    if (ratio > 50) {
      insights.push({
        id: 'hospital-capacity',
        type: 'warning',
        title: '医院承载量偏紧',
        content: `当前医院 ${hospitals.total} 家服务 ${totalCustomers} 位客户（比例 1:${Math.round(ratio)}），建议加快优质医院签约。`,
        actionText: '管理医院',
        actionLink: '/crm/hospitals',
      });
    }
  }

  // 3. 成交/已手术占比
  const doneCustomer = customerByStatus.find(
    (s) => s.name.includes('已手术') || s.name.includes('已成交'),
  );
  if (doneCustomer && totalCustomers > 0) {
    const donePct = (doneCustomer.count / totalCustomers) * 100;
    if (donePct < 2 && totalCustomers > 50) {
      insights.push({
        id: 'conversion-low',
        type: 'warning',
        title: '成交转化率较低',
        content: `当前已成交客户 ${doneCustomer.count} 人（占比 ${formatPercent(donePct)}），建议回顾派单匹配和医院服务质量。`,
        actionText: '查看客户详情',
        actionLink: '/crm/customers',
      });
    }
  }

  // 限制最多返回 5 条
  return insights.slice(0, 5);
}

/* ──────── 本期摘要 ──────── */

/**
 * 构建本期摘要。
 *
 * 汇总当前统计周期的关键数据，非真实操作记录。
 * 每条摘要对应一个维度的汇总数字，便于运营人员快速了解本期概况。
 */
export function buildRecentActivities(
  stats: DashboardStats,
  hasDateRange?: boolean,
): RecentActivity[] {
  const activities: RecentActivity[] = [];
  const periodLabel = hasDateRange ? '本期' : '本月';

  if (stats.customers.periodNew > 0) {
    activities.push({
      id: 'customer-new',
      type: '新增',
      action: '新客户录入',
      target: `${periodLabel}新增 ${stats.customers.periodNew} 人`,
      operator: '',
      time: new Date(),
    });
  }

  if (stats.dispatches.periodNew > 0) {
    activities.push({
      id: 'dispatch-new',
      type: '派单',
      action: '新派单创建',
      target: `${periodLabel}新增 ${stats.dispatches.periodNew} 单`,
      operator: '',
      time: new Date(),
    });
  }

  if (stats.dispatches.periodCompleted > 0) {
    activities.push({
      id: 'dispatch-done',
      type: '成交',
      action: '派单已完成',
      target: `${periodLabel}完成 ${stats.dispatches.periodCompleted} 单`,
      operator: '',
      time: new Date(),
    });
  }

  if (stats.hospitals.periodNew > 0) {
    activities.push({
      id: 'hospital-new',
      type: '签约',
      action: '新医院签约',
      target: `${periodLabel}新增 ${stats.hospitals.periodNew} 家`,
      operator: '',
      time: new Date(),
    });
  }

  const arrivedCount =
    stats.customerByStatus.find((s) => s.name.includes('已到院'))?.count ?? 0;
  if (arrivedCount > 0) {
    activities.push({
      id: 'arrival',
      type: '到院',
      action: '客户到院就诊',
      target: `累计到院 ${arrivedCount} 人`,
      operator: '',
      time: new Date(),
    });
  }

  return activities;
}

/* ──────── 医院排行榜 ──────── */

export function buildHospitalRankings(
  _stats: DashboardStats,
): HospitalRankingItem[] {
  // 后端暂未提供按医院聚合的指标数据，排行榜返回空数组。
  // UI 将显示"暂无排名数据"状态。
  return [];
}

/* ──────── 客户状态处理 ──────── */

/** 判断客户状态是否几乎只有单一状态 */
export function isSingleCustomerStatus(items: StatusItem[]): boolean {
  if (!items || items.length <= 1) return true;
  const sorted = [...items].sort((a, b) => b.count - a.count);
  // 最高状态占 95% 以上视为单一状态
  const total = sorted.reduce((s, i) => s + i.count, 0);
  return total > 0 && sorted[0].count / total >= 0.95;
}

/** 状态颜色映射（仅关键状态使用语义色） */
export function getStatusColor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('成交') || lower.includes('手术')) return '#52C41A';
  if (
    lower.includes('失败') ||
    lower.includes('超时') ||
    lower.includes('未成交')
  )
    return '#FF4D4F';
  if (lower.includes('到院')) return '#FAAD14';
  // 其余状态统用主色
  return '#1677FF';
}
