import { Column } from '@ant-design/charts';
import { RiseOutlined } from '@ant-design/icons';
import { Space, Statistic } from 'antd';
import React, { useMemo } from 'react';
import ChartCard from './ChartCard';
import type { TrendDataPoint } from '../types';
import { formatNumber } from '../utils';
import { CHART_HEIGHT } from '../constants';

interface CustomerTrendCardProps {
  data: TrendDataPoint[];
  loading?: boolean;
  error?: Error | null;
}

/**
 * 客户新增趋势图。
 * 柱状图展示近 N 个月客户新增趋势，含摘要数据行。
 */
const CustomerTrendCard: React.FC<CustomerTrendCardProps> = ({
  data,
  loading,
  error,
}) => {
  const safeData = data && data.length > 0 ? data : [];

  const summary = useMemo(() => {
    if (!safeData.length) return null;
    const last = safeData[safeData.length - 1];
    const values = safeData.map((d) => d.count);
    const peak = Math.max(...values);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const prev = safeData.length >= 2 ? safeData[safeData.length - 2]?.count ?? 0 : 0;
    const mom =
      prev > 0 ? `${((last.count - prev) / prev * 100).toFixed(1)}%` : '--';
    return { last: last.count, mom, avg, peak };
  }, [safeData]);

  const chartData = useMemo(
    () => safeData.map((d) => ({ month: d.month, value: d.count, type: '新增客户' })),
    [safeData],
  );

  return (
    <ChartCard
      title={
        <Space size={8}>
          <RiseOutlined style={{ color: '#1677FF' }} />
          <span>客户新增趋势</span>
        </Space>
      }
      subtitle={
        safeData.length > 0
          ? `近 ${safeData.length} 个月新增客户数量`
          : undefined
      }
      loading={loading}
      error={error}
      empty={!safeData.length}
      emptyText="暂无客户趋势数据"
      height={CHART_HEIGHT}
    >
      {/* 摘要数据行 */}
      {summary && (
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginBottom: 16,
            padding: '12px 16px',
            background: '#FAFAFA',
            borderRadius: 6,
          }}
        >
          <Statistic
            title="本期新增"
            value={summary.last}
            valueStyle={{ fontSize: 20, fontWeight: 600 }}
          />
          <Statistic
            title="环比"
            value={summary.mom}
            valueStyle={{
              fontSize: 20,
              fontWeight: 600,
              color: summary.mom.startsWith('-') ? '#FF4D4F' : '#52C41A',
            }}
          />
          <Statistic
            title="月均"
            value={summary.avg}
            valueStyle={{ fontSize: 20, fontWeight: 600 }}
          />
          <Statistic
            title="峰值"
            value={summary.peak}
            valueStyle={{ fontSize: 20, fontWeight: 600 }}
          />
        </div>
      )}

      {/* 柱状图（空数据时由 ChartCard 显示 Empty，不渲染 children） */}
      {chartData.length > 0 && (
        <Column
          data={chartData}
          xField="month"
          yField="value"
          color="#1677FF"
          columnStyle={{ radius: [4, 4, 0, 0] }}
          height={CHART_HEIGHT}
          autoFit
          label={{
            position: 'top',
            style: { fontSize: 10, fill: 'rgba(0,0,0,0.45)' },
            formatter: (v: Record<string, unknown>) =>
              (v.value as number) > 0 ? String(v.value) : '',
          }}
          xAxis={{
            label: { autoRotate: true, style: { fontSize: 11 } },
          }}
          yAxis={{
            grid: {
              line: { style: { stroke: '#F0F0F0', lineDash: [3, 3] } },
            },
          }}
          legend={false}
          tooltip={{
            formatter: (datum: Record<string, unknown>) => ({
              name: '新增客户',
              value: formatNumber(datum.value as number),
            }),
          }}
        />
      )}
    </ChartCard>
  );
};

export default CustomerTrendCard;
