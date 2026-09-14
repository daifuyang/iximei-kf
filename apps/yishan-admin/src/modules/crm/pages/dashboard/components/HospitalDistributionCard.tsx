import { Bar } from '@ant-design/charts';
import { EnvironmentOutlined } from '@ant-design/icons';
import { Button, Segmented, Table } from 'antd';
import React, { useMemo, useState } from 'react';
import ChartCard from './ChartCard';
import { CHART_HEIGHT } from '../constants';
import { formatNumber } from '../utils';
import type {
  HospitalDistributionSelection,
  HospitalOverviewCategoryCount,
  HospitalOverviewCity,
  HospitalOverviewProvince,
} from '../types';

interface Props {
  byProvince?: HospitalOverviewProvince[];
  byCity?: HospitalOverviewCity[];
  byCategory?: HospitalOverviewCategoryCount[];
  loading?: boolean;
  error?: Error | null;
  onSelect?: (selection: HospitalDistributionSelection) => void;
}

type Dimension = 'province' | 'city' | 'category';
type View = 'chart' | 'table';

const TOP_N = 20;
const categoryNames: Record<string, string> = {
  oral: '口腔医院',
  plastic: '整形医院',
  unknown: '未分类医院',
};

const HospitalDistributionCard: React.FC<Props> = ({
  byProvince = [],
  byCity = [],
  byCategory = [],
  loading,
  error,
  onSelect,
}) => {
  const [dimension, setDimension] = useState<Dimension>('province');
  const [view, setView] = useState<View>('chart');

  const items = useMemo(() => {
    if (dimension === 'province') {
      return byProvince.map((item) => ({
        key: `province-${item.provinceCode}`,
        label: item.provinceName,
        count: item.hospitalCount,
        selection: { provinceCode: item.provinceCode },
      }));
    }
    if (dimension === 'city') {
      return byCity.map((item) => ({
        key: `city-${item.provinceCode}-${item.cityCode}`,
        label: `${item.provinceName} ${item.cityName}`,
        count: item.hospitalCount,
        selection: { provinceCode: item.provinceCode, cityCode: item.cityCode },
      }));
    }
    return byCategory.map((item) => ({
      key: `category-${item.category}`,
      label: categoryNames[item.category],
      count: item.hospitalCount,
      selection: { category: item.category },
    }));
  }, [byCategory, byCity, byProvince, dimension]);

  const ranked = useMemo(
    () => [...items].sort((a, b) => b.count - a.count).slice(0, TOP_N),
    [items],
  );
  const chartHeight = Math.max(CHART_HEIGHT, ranked.length * 28 + 72);

  return (
    <ChartCard
      title={<span><EnvironmentOutlined style={{ color: '#1677ff', marginRight: 8 }} />医院分布</span>}
      subtitle="按当前筛选范围排名，点击可下钻医院明细"
      loading={loading}
      error={error}
      empty={ranked.length === 0}
      emptyText="暂无医院数据"
      height={CHART_HEIGHT}
      extra={(
        <>
          <Segmented<Dimension>
            options={[
              { label: '省份', value: 'province' },
              { label: '城市', value: 'city' },
              { label: '类型', value: 'category' },
            ]}
            value={dimension}
            onChange={(value) => setDimension(value)}
          />
          <Segmented<View>
            style={{ marginLeft: 8 }}
            options={[
              { label: '图表', value: 'chart' },
              { label: '表格', value: 'table' },
            ]}
            value={view}
            onChange={(value) => setView(value)}
          />
        </>
      )}
    >
      {view === 'chart' ? (
        <Bar
          data={ranked}
          xField="count"
          yField="label"
          height={chartHeight}
          autoFit
          color="#1677ff"
          onReady={(plot: any) => {
            plot.on('element:click', (event: any) => {
              const selection = event?.data?.data?.selection;
              if (selection) onSelect?.(selection);
            });
          }}
          tooltip={{
            formatter: (datum: { count: number }) => ({ name: '医院数', value: formatNumber(datum.count) }),
          }}
        />
      ) : (
        <Table
          size="small"
          rowKey="key"
          dataSource={ranked}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          columns={[
            {
              title: dimension === 'category' ? '类型' : dimension === 'city' ? '城市' : '省份',
              dataIndex: 'label',
              key: 'label',
              render: (label: string, row: typeof ranked[number]) => (
                <Button type="link" onClick={() => onSelect?.(row.selection)}>{label}</Button>
              ),
            },
            {
              title: '医院数',
              dataIndex: 'count',
              key: 'count',
              align: 'right' as const,
              render: (value: number) => formatNumber(value),
            },
          ]}
        />
      )}
    </ChartCard>
  );
};

export default HospitalDistributionCard;
