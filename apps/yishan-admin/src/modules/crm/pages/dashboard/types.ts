/**
 * 数据看板 — 类型定义
 */

/* ---------- 后端接口原始数据结构 ---------- */

export interface DashboardStats {
  generatedAt?: string;
  hospitals: {
    total: number;
    periodNew: number;
    monthNew: number;
    weekNew: number;
    activeCount: number;
  };
  customers: {
    total: number;
    periodNew: number;
    monthNew: number;
    weekNew: number;
    dayNew: number;
  };
  dispatches: {
    total: number;
    periodNew: number;
    periodCompleted: number;
    monthNew: number;
    weekNew: number;
    monthCompleted: number;
  };
  customerByStatus: StatusItem[];
  dispatchByStatus: StatusItem[];
  monthlyTrend: {
    customers: TrendDataPoint[];
    dispatches: TrendDataPoint[];
  };
}

/** 看板统计接口查询参数 */
export interface DashboardStatsParams {
  startDate?: string;
  endDate?: string;
  hospitalId?: number;
}

/* ---------- 通用类型 ---------- */

export interface StatusItem {
  name: string;
  count: number;
}

export interface TrendDataPoint {
  month: string;
  count: number;
}

/* ---------- 筛选 ---------- */

export interface DashboardFilters {
  hospitalId?: number;
  timeRange?: 'today' | 'week' | 'month' | '30d' | '12m' | 'custom';
  startDate?: string;
  endDate?: string;
}

/* ---------- 指标卡 ---------- */

export interface MetricItem {
  key: string;
  title: string;
  tooltip: string;
  value: number;
  suffix: string;
  trend?: {
    value: number;
    label: string;
    positive: boolean; // true = 上升对本指标是好的
  };
  extra: {
    label: string;
    value: number | string;
  };
  link?: string;
}

/* ---------- 漏斗 ---------- */

export interface FunnelStage {
  label: string;
  value: number;
  unit: string;
  cumulativeRate: number | null; // 相对初始阶段的累计转化率，null 表示口径不一致
  stageRate: number | null; // 相对上一阶段的转化率
}

/* ---------- 经营洞察 ---------- */

export type InsightType = 'success' | 'warning' | 'error' | 'info';

export interface BusinessInsight {
  id: string;
  type: InsightType;
  title: string;
  content: string;
  actionText?: string;
  actionLink?: string;
}

/* ---------- 最近动态 ---------- */

export interface RecentActivity {
  id: string;
  type: string;
  action: string;
  target: string;
  operator: string;
  time: Date;
  detail?: Record<string, unknown>;
}

/* ---------- 医院排行 ---------- */

export interface HospitalRankingItem {
  rank: number;
  name: string;
  dispatchCount: number;
  arrivalRate?: number;
  conversionRate?: number;
  trend?: number; // 排名变化，正=上升
}

/* ---------- 看板页面整体响应（经过适配层） ---------- */

export interface DashboardData {
  stats: DashboardStats;
  metrics: MetricItem[];
  funnelStages: FunnelStage[];
  insights: BusinessInsight[];
  activities: RecentActivity[];
  hospitalRankings: HospitalRankingItem[];
  lastUpdated: string;
}
