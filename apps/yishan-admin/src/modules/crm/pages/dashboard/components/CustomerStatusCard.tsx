import { Pie } from '@ant-design/charts';
import { PieChartOutlined } from '@ant-design/icons';
import { Button, Empty, Space } from 'antd';
import React, { useMemo } from 'react';
import { history } from '@umijs/max';
import ChartCard from './ChartCard';
import type { StatusItem } from '../types';
import { formatNumber, isSingleCustomerStatus } from '../utils';
import { CHART_HEIGHT } from '../constants';

interface CustomerStatusCardProps {
  data: StatusItem[];
  total: number;
  loading?: boolean;
  error?: Error | null;
}

/**
 * 客户状态分布。
 *
 * - 多状态（≥2 且非单一状态）：小型 Donut 图 + 状态明细
 * - 单一状态（≥95% 集中）：改为信息型展示，不强行画 100% 圆环
 */
const CustomerStatusCard: React.FC<CustomerStatusCardProps> = ({
  data,
  total,
  loading,
  error,
}) => {
  const singleStatus = useMemo(() => isSingleCustomerStatus(data), [data]);
  const mainStatus = data.length > 0 ? data.reduce((a, b) => (a.count > b.count ? a : b)) : null;

  const renderContent = () => {
    // 单一状态 → 信息型展示
    if (singleStatus && mainStatus) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: CHART_HEIGHT - 40,
            textAlign: 'center',
            padding: 24,
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: 'rgba(0,0,0,0.88)', marginBottom: 8 }}>
            {formatNumber(total)}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.65)', marginBottom: 4 }}>
            {total} 位客户均处于「{mainStatus.name}」阶段
          </div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginBottom: 16 }}>
            暂无已派单客户
          </div>
          <Button
            type="primary"
            size="small"
            onClick={() => history.push('/crm/customers')}
          >
            查看客户列表
          </Button>
        </div>
      );
    }

    // 多状态 → Donut + 列表
    if (data.length > 0) {
      const pieData = data.map((d) => ({ name: d.name, value: d.count }));
      return (
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', minHeight: CHART_HEIGHT - 40 }}>
          {/* Donut 图 */}
          <div style={{ width: 180, flexShrink: 0 }}>
            <Pie
              data={pieData}
              angleField="value"
              colorField="name"
              innerRadius={0.6}
              radius={0.9}
              height={180}
              autoFit={false}
              legend={false}
              label={false}
              tooltip={{
                formatter: (datum: Record<string, unknown>) => ({
                  name: datum.name as string,
                  value: `${datum.value} 人`,
                }),
              }}
              statistic={{
                title: {
                  formatter: () => '总计',
                  style: { fontSize: 12, color: 'rgba(0,0,0,0.45)' },
                },
                content: {
                  formatter: () => String(total),
                  style: { fontSize: 20, fontWeight: 700 },
                },
              }}
              color={['#1677FF', '#52C41A', '#FAAD14', '#FF4D4F', '#A0A0A0']}
            />
          </div>

          {/* 状态明细列表 */}
          <div style={{ flex: 1, fontSize: 13 }}>
            {data
              .sort((a, b) => b.count - a.count)
              .map((item) => {
                const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0';
                return (
                  <button
                    key={item.name}
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      border: 'none',
                      borderBottom: '1px solid #FAFAFA',
                      cursor: 'pointer',
                      background: 'none',
                      width: '100%',
                      font: 'inherit',
                      color: 'inherit',
                    }}
                    onClick={() => history.push(`/crm/customers?status=${encodeURIComponent(item.name)}`)}
                    aria-label={`${item.name}：${item.count} 人`}
                  >
                    <span style={{ color: 'rgba(0,0,0,0.88)' }}>{item.name}</span>
                    <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                      {item.count} 人 · {pct}%
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      );
    }

    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无客户状态数据" />;
  };

  return (
    <ChartCard
      title={
        <Space size={8}>
          <PieChartOutlined style={{ color: '#1677FF' }} />
          <span>客户状态分布</span>
        </Space>
      }
      loading={loading}
      error={error}
      empty={!data.length}
      emptyText="暂无客户状态数据"
      height={CHART_HEIGHT}
    >
      {renderContent()}
    </ChartCard>
  );
};

export default CustomerStatusCard;
