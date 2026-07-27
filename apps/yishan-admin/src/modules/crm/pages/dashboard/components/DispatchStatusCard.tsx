import { BarChartOutlined } from '@ant-design/icons';
import { Space, Tooltip } from 'antd';
import React, { useMemo } from 'react';
import { history } from '@umijs/max';
import ChartCard from './ChartCard';
import type { StatusItem } from '../types';
import { formatNumber, formatPercent, getStatusColor, safeDivide } from '../utils';
import { CHART_HEIGHT } from '../constants';
import styles from '../index.module.less';

interface DispatchStatusCardProps {
  data: StatusItem[];
  loading?: boolean;
  error?: Error | null;
}

/**
 * 派单状态分布 — 横向条形列表。
 *
 * 替代原来的饼图，按数量降序排列，每个状态一行：
 * 状态名称 | 横向进度条 | 数量 | 占比
 *
 * data 为空时由 ChartCard 显示 Empty（无 description，垂直居中）。
 */
const DispatchStatusCard: React.FC<DispatchStatusCardProps> = ({
  data,
  loading,
  error,
}) => {
  const sorted = useMemo(
    () => (data ? [...data].sort((a, b) => b.count - a.count) : []),
    [data],
  );

  const maxCount = sorted.length > 0 ? sorted[0].count : 0;
  const total = sorted.reduce((s, i) => s + i.count, 0);

  return (
    <ChartCard
      title={
        <Space size={8}>
          <BarChartOutlined style={{ color: '#1677FF' }} />
          <span>派单状态分布</span>
        </Space>
      }
      loading={loading}
      error={error}
      empty={!sorted.length}
      emptyText="暂无派单状态数据"
      height={CHART_HEIGHT}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: CHART_HEIGHT - 40 }}>
        {/* 表头 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 0 8px',
            borderBottom: '1px solid #FAFAFA',
            fontSize: 12,
            color: 'rgba(0,0,0,0.45)',
          }}
        >
          <span style={{ width: 64, flexShrink: 0 }}>状态</span>
          <span style={{ flex: 1 }}>分布</span>
          <span style={{ width: 72, textAlign: 'right', flexShrink: 0 }}>数量</span>
          <span style={{ width: 52, textAlign: 'right', flexShrink: 0 }}>占比</span>
        </div>

        {/* 数据行 */}
        {sorted.map((item) => {
          const pct = safeDivide(item.count, total);
          const barWidth = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          const color = getStatusColor(item.name);

          return (
            <button
              key={item.name}
              className={styles.dispatchItem}
              type="button"
              onClick={() =>
                history.push(
                  `/crm/dispatches?status=${encodeURIComponent(item.name)}`,
                )
              }
              aria-label={`${item.name}：${item.count} 单，占比 ${formatPercent(pct)}`}
            >
              <span className={styles.dispatchName}>
                <Tooltip title={item.name}>
                  {item.name}
                </Tooltip>
              </span>
              <div className={styles.dispatchBar}>
                <div
                  className={styles.dispatchBarFill}
                  style={{
                    width: `${barWidth}%`,
                    background: color,
                  }}
                />
              </div>
              <span className={styles.dispatchCount}>
                {formatNumber(item.count)}
              </span>
              <span className={styles.dispatchPercent}>
                {formatPercent(pct)}
              </span>
            </button>
          );
        })}

        {/* 合计 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 0 0',
            borderTop: '1px solid #FAFAFA',
            fontSize: 13,
          }}
        >
          <span style={{ width: 64, flexShrink: 0, fontWeight: 500 }}>合计</span>
          <span style={{ flex: 1 }} />
          <span
            style={{
              width: 72,
              textAlign: 'right',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {formatNumber(total)}
          </span>
          <span style={{ width: 52, textAlign: 'right', flexShrink: 0 }}>100%</span>
        </div>
      </div>
    </ChartCard>
  );
};

export default DispatchStatusCard;
