import { DeploymentUnitOutlined, TeamOutlined, SendOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Card, Col, Row, Tooltip, Typography } from 'antd';
import React from 'react';
import { history } from '@umijs/max';
import type { MetricItem } from '../types';
import { GRID_COL } from '../constants';
import { formatNumber } from '../utils';
import styles from '../index.module.less';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const METRIC_ICONS: Record<string, React.ReactNode> = {
  hospitals: <DeploymentUnitOutlined />,
  customers: <TeamOutlined />,
  dispatches: <SendOutlined />,
  completed: <CheckCircleOutlined />,
};

interface MetricCardsProps {
  metrics: MetricItem[];
  loading?: boolean;
}

const MetricCard: React.FC<{
  item: MetricItem;
  loading?: boolean;
}> = ({ item, loading }) => {
  const handleClick = () => {
    if (item.link) {
      history.push(item.link);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && item.link) {
      history.push(item.link);
    }
  };

  const trendUp = item.trend ? item.trend.value > 0 : false;
  const trendClass = item.trend
    ? item.trend.positive
      ? trendUp
        ? styles.metricTrendUp
        : styles.metricTrendDown
      : trendUp
        ? styles.metricTrendDown
        : styles.metricTrendUp
    : undefined;

  return (
    <Card
      className={styles.metricCard}
      loading={loading}
      tabIndex={item.link ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={item.link ? `${item.title}，点击查看详情` : item.title}
      styles={{ body: { padding: '20px' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 标题行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={styles.metricIcon}>{METRIC_ICONS[item.key]}</span>
          <Text
            style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,0,0,0.65)' }}
          >
            {item.title}
          </Text>
          <Tooltip title={item.tooltip}>
            <InfoCircleOutlined
              style={{ fontSize: 13, color: 'rgba(0,0,0,0.25)', cursor: 'help' }}
            />
          </Tooltip>
        </div>

        {/* 主数值 */}
        <div>
          <span className={styles.metricValue}>
            {item.suffix === '%' ? `${item.value.toFixed(1)}` : formatNumber(item.value)}
          </span>
          <span className={styles.metricSuffix}>{item.suffix}</span>
        </div>

        {/* 趋势 + 补充指标 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {item.trend ? (
            <span className={`${styles.metricTrend} ${trendClass || ''}`}>
              {trendUp ? '↑' : '↓'} {item.trend.label}
            </span>
          ) : (
            <span />
          )}
          <span className={styles.metricExtra}>
            {item.extra.label}：{item.extra.value}
          </span>
        </div>
      </div>
    </Card>
  );
};

/**
 * 核心指标卡区域。
 * 4 张统一规格卡片：医院总数 / 客户总数 / 本月派单 / 本月完成率。
 */
const MetricCards: React.FC<MetricCardsProps> = ({ metrics, loading }) => (
  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
    {metrics.map((item) => (
      <Col key={item.key} {...GRID_COL.metricCard}>
        <MetricCard item={item} loading={loading} />
      </Col>
    ))}
  </Row>
);

export default MetricCards;
