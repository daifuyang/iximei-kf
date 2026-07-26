/**
 * 数据看板 — 常量
 */

/** 时间范围选项 */
export const TIME_RANGE_OPTIONS = [
  { label: '今日', value: 'today' as const },
  { label: '本周', value: 'week' as const },
  { label: '本月', value: 'month' as const },
  { label: '近 30 天', value: '30d' as const },
  { label: '近 12 月', value: '12m' as const },
];

/** 页面栅格断点 */
export const GRID_COL = {
  /** 4 列指标卡 */
  metricCard: { xs: 24, sm: 12, lg: 6 } as const,
  /** 宽图表卡片 (趋势图/派单状态) */
  wider: { xs: 24, lg: 14 } as const,
  /** 窄图表卡片 (状态分布/漏斗) */
  narrower: { xs: 24, lg: 10 } as const,
  /** 半宽卡片 (动态/排行) */
  half: { xs: 24, lg: 12 } as const,
  /** 全宽 */
  full: { xs: 24 } as const,
};

/** 图表默认高度 */
export const CHART_HEIGHT = 300;
