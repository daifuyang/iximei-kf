/**
 * 医院分布看板。
 *
 * 按城市维度展示「口腔医院 / 整形医院」数量分布。
 * - 双 Tab：柱状图（默认，top 20）/ 明细表
 * - 柱状图：横向分组柱状图（@ant-design/charts Bar），城市维度按 total DESC
 * - 明细表：省份 | 城市 | 口腔医院数 | 整形医院数 | 合计
 * - 数据为空时显示 Empty
 * - 仅 super_admin / admin 看得到真实数据；其他角色会拿到空数组，卡片也走 Empty 分支
 */

import { Bar } from '@ant-design/charts';
import { EnvironmentOutlined } from '@ant-design/icons';
import { Empty, Segmented, Table } from 'antd';
import React, { useMemo, useState } from 'react';
import ChartCard from './ChartCard';
import { formatNumber } from '../utils';
import { CHART_HEIGHT } from '../constants';

export interface HospitalDistributionItem {
  provinceCode: number;
  provinceName: string;
  cityCode: number;
  cityName: string;
  oralCount: number;
  plasticCount: number;
  total: number;
}

export interface HospitalDistributionData {
  generatedAt?: string;
  items?: HospitalDistributionItem[];
}

interface Props {
  data?: HospitalDistributionData;
  loading?: boolean;
  error?: Error | null;
}

type ViewMode = 'chart' | 'table';

const TOP_N = 20;

const HospitalDistributionCard: React.FC<Props> = ({ data, loading, error }) => {
  const [view, setView] = useState<ViewMode>('chart');

  const items = data?.items ?? [];

  // 排序 + 截取 top 20 给柱状图用
  const top = useMemo(() => {
    return [...items]
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_N);
  }, [items]);

  const chartData = useMemo(
    () =>
      top.flatMap((it) => [
        { city: it.cityName || '未知', type: '口腔医院', count: it.oralCount },
        { city: it.cityName || '未知', type: '整形医院', count: it.plasticCount },
      ]),
    [top],
  );

  // 柱状图高度：动态按城市数量伸缩，基础高度 280，每条 +24
  const chartHeight = useMemo(
    () => Math.max(CHART_HEIGHT, top.length * 24 + 80),
    [top.length],
  );

  const tableColumns = [
    { title: '省份', dataIndex: 'provinceName', key: 'provinceName', width: 100 },
    { title: '城市', dataIndex: 'cityName', key: 'cityName', width: 100 },
    {
      title: '口腔医院数',
      dataIndex: 'oralCount',
      key: 'oralCount',
      width: 110,
      align: 'right' as const,
      render: (v: number) => formatNumber(v),
    },
    {
      title: '整形医院数',
      dataIndex: 'plasticCount',
      key: 'plasticCount',
      width: 110,
      align: 'right' as const,
      render: (v: number) => formatNumber(v),
    },
    {
      title: '合计',
      dataIndex: 'total',
      key: 'total',
      width: 80,
      align: 'right' as const,
      render: (v: number) => formatNumber(v),
    },
  ];

  const renderChart = () => {
    if (top.length === 0) return null;
    return (
      <Bar
        data={chartData}
        xField="count"
        yField="city"
        colorField="type"
        stack={false}
        group={true}
        sort={{ reverse: true, by: 'x' }}
        height={chartHeight}
        autoFit
        legend={{
          color: {
            position: 'top-right',
          },
        }}
        axis={{
          x: {
            title: '医院数',
          },
          y: {
            title: '',
          },
        }}
        tooltip={{
          formatter: (datum: Record<string, unknown>) => ({
            name: datum.type as string,
            value: `${formatNumber(datum.count as number)} 家`,
          }),
        }}
        scale={{
          color: {
            range: ['#1677FF', '#52C41A'],
          },
        }}
      />
    );
  };

  const renderTable = () => (
    <Table<HospitalDistributionItem>
      size="small"
      rowKey={(r) => `${r.provinceCode}-${r.cityCode}`}
      columns={tableColumns}
      dataSource={items}
      pagination={{ pageSize: 10, showSizeChanger: false }}
    />
  );

  return (
    <ChartCard
      title={
        <span>
          <EnvironmentOutlined style={{ color: '#1677FF', marginRight: 8 }} />
          医院分布看板
        </span>
      }
      subtitle="按城市维度展示口腔 / 整形医院数量"
      loading={loading}
      error={error}
      empty={items.length === 0}
      emptyText="暂无医院数据"
      extra={
        items.length > 0 ? (
          <Segmented<ViewMode>
            options={[
              { label: '柱状图', value: 'chart' },
              { label: '明细表', value: 'table' },
            ]}
            value={view}
            onChange={(v) => setView(v)}
          />
        ) : undefined
      }
      height={CHART_HEIGHT}
    >
      {/* ChartCard 在 empty=true 时不渲染 children，但这里也兜个底 */}
      {items.length === 0 ? (
        <div
          style={{
            minHeight: CHART_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Empty description="暂无医院数据" />
        </div>
      ) : view === 'chart' ? (
        renderChart()
      ) : (
        renderTable()
      )}
    </ChartCard>
  );
};

export default HospitalDistributionCard;