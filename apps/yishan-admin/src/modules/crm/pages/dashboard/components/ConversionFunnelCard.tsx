import { InfoCircleOutlined, FunnelPlotOutlined } from '@ant-design/icons';
import { Empty, Space, Tooltip } from 'antd';
import React, { useMemo } from 'react';
import ChartCard from './ChartCard';
import type { FunnelStage } from '../types';
import { formatNumber, formatPercent } from '../utils';
import { CHART_HEIGHT } from '../constants';
import styles from '../index.module.less';

interface ConversionFunnelCardProps {
  stages: FunnelStage[];
  loading?: boolean;
  error?: Error | null;
}

const FUNNEL_COLORS = ['#1677FF', '#69B1FF', '#91CAFF', '#52C41A'];

/**
 * 客户状态结构（存量）。
 *
 * 按客户当前所处状态展示人数分布，非严格转化漏斗。
 * 统计口径：全量客户按当前状态去重。
 */
const ConversionFunnelCard: React.FC<ConversionFunnelCardProps> = ({
  stages,
  loading,
  error,
}) => {
  const hasData = stages.length > 0;
  const maxValue = useMemo(
    () => (hasData ? Math.max(...stages.map((s) => s.value)) : 1),
    [stages, hasData],
  );

  const renderContent = () => {
    if (!hasData) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无客户状态数据" />;
    }

    return (
      <div style={{ minHeight: CHART_HEIGHT - 40 }}>
        {stages.map((stage, i) => {
          const barWidth = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
          const fillColor = FUNNEL_COLORS[i % FUNNEL_COLORS.length];

          return (
            <div key={stage.label} className={styles.funnelItem}>
              {/* 阶段标签 */}
              <span className={styles.funnelLabel}>{stage.label}</span>

              {/* 进度条 */}
              <div className={styles.funnelBar}>
                <div
                  className={styles.funnelBarFill}
                  style={{
                    width: `${barWidth}%`,
                    background: fillColor,
                  }}
                >
                  {barWidth > 15 ? (
                    <span style={{ fontSize: 12 }}>
                      {formatNumber(stage.value)}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* 数值 */}
              <span className={styles.funnelValue}>
                {formatNumber(stage.value)}
                <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>
                  {stage.unit}
                </span>
              </span>

              {/* 累计转化率 */}
              <Tooltip
                title={
                  stage.cumulativeRate != null
                    ? `相对客户录入的累计转化率`
                    : '数据口径不一致，无法计算转化率'
                }
              >
                <span className={styles.funnelRate}>
                  {stage.cumulativeRate != null
                    ? formatPercent(stage.cumulativeRate)
                    : '--'}
                </span>
              </Tooltip>
            </div>
          );
        })}

        {/* 数据口径说明 */}
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#FAFAFA',
            borderRadius: 6,
            fontSize: 12,
            color: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 4,
          }}
        >
          <InfoCircleOutlined style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            统计口径：全量客户按当前所处状态去重。非严格转化漏斗，各阶段为客户当前状态的人数分布。
          </span>
        </div>
      </div>
    );
  };

  return (
    <ChartCard
      title={
        <Space size={8}>
          <FunnelPlotOutlined style={{ color: '#1677FF' }} />
          <span>客户状态结构</span>
          <Tooltip title="按客户当前所处状态展示人数分布，非严格转化漏斗。">
            <InfoCircleOutlined
              style={{ fontSize: 13, color: 'rgba(0,0,0,0.25)', cursor: 'help' }}
            />
          </Tooltip>
        </Space>
      }
      loading={loading}
      error={error}
      empty={!hasData}
      emptyText="暂无客户状态数据"
      height={CHART_HEIGHT}
    >
      {renderContent()}
    </ChartCard>
  );
};

export default ConversionFunnelCard;
