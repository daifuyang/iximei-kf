import { PageContainer } from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import { Alert, Button, Card, DatePicker, Select, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getHospitalOverview } from '../../api';
import HospitalDistributionCard from './components/HospitalDistributionCard';
import HospitalCityDrilldownDrawer from './components/HospitalCityDrilldownDrawer';
import HospitalDrilldownDrawer from './components/HospitalDrilldownDrawer';
import HospitalOverviewKpis from './components/HospitalOverviewKpis';
import LegacyCrmDashboardSection from './components/LegacyCrmDashboardSection';
import styles from './index.module.less';
import type {
  HospitalDistributionSelection,
  HospitalOverview,
  HospitalOverviewCategory,
  HospitalOverviewFilters,
} from './types';
import { normalizeHospitalOverview } from './types';
import { readFilters, writeFilters } from './filters';

const { RangePicker } = DatePicker;

const categories: Array<{ label: string; value: HospitalOverviewCategory }> = [
  { label: '口腔医院', value: 'oral' },
  { label: '整形医院', value: 'plastic' },
  { label: '未分类医院', value: 'unknown' },
];

const DashboardPage: React.FC = () => {
  const location = useLocation();
  const filters = useMemo(() => readFilters(location.search), [location.search]);
  const [overview, setOverview] = useState<HospitalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cityDrawerOpen, setCityDrawerOpen] = useState(false);
  const requestRef = useRef(0);

  const updateFilters = useCallback((next: HospitalOverviewFilters) => {
    const query = writeFilters(next);
    history.replace(`${location.pathname}${query ? `?${query}` : ''}`);
  }, [location.pathname]);

  const fetchOverview = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await getHospitalOverview(filters);
      if (request !== requestRef.current) return;
      if (!response?.success) throw new Error(response?.message || '获取医院总览失败');
      setOverview(normalizeHospitalOverview(response.data));
    } catch (cause) {
      if (request !== requestRef.current) return;
      setError(cause instanceof Error ? cause : new Error('获取医院总览失败'));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const applySelection = useCallback((selection: HospitalDistributionSelection, openDrawer = true) => {
    const next: HospitalOverviewFilters = { ...filters };
    if (selection.category !== undefined || Object.keys(selection).length === 0) {
      next.category = selection.category;
    }
    if (selection.provinceCode !== undefined) {
      next.provinceCode = selection.provinceCode;
      next.cityCode = selection.cityCode;
    } else if (selection.cityCode !== undefined) {
      next.cityCode = selection.cityCode;
    }
    updateFilters(next);
    if (openDrawer) {
      if (selection.provinceCode !== undefined && selection.cityCode === undefined) {
        setCityDrawerOpen(true);
      } else {
        setDrawerOpen(true);
      }
    }
  }, [filters, updateFilters]);

  const cities = useMemo(() => {
    const source = overview?.byCity ?? [];
    return source.filter((item) => !filters.provinceCode || item.provinceCode === filters.provinceCode);
  }, [filters.provinceCode, overview?.byCity]);

  const setDateRange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    updateFilters({
      ...filters,
      startDate: dates?.[0]?.format('YYYY-MM-DD'),
      endDate: dates?.[1]?.format('YYYY-MM-DD'),
    });
  };

  const categoryRows = overview?.businessByCategory ?? [];

  return (
    <PageContainer
      header={{
        title: '医院资源总览',
        subTitle: '统一筛选医院规模、分布与经营表现',
      }}
    >
      <div className={styles.pageContent}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <RangePicker
              value={filters.startDate && filters.endDate ? [dayjs(filters.startDate), dayjs(filters.endDate)] : null}
              onChange={setDateRange}
              aria-label="统计时间范围"
            />
            <Select
              allowClear
              placeholder="全部类型"
              value={filters.category}
              options={categories}
              onChange={(category) => updateFilters({ ...filters, category })}
              style={{ width: 132 }}
              aria-label="医院类型"
            />
            <Select
              allowClear
              placeholder="全部省份"
              value={filters.provinceCode}
              options={(overview?.byProvince ?? []).map((item) => ({ label: item.provinceName, value: item.provinceCode }))}
              onChange={(provinceCode) => updateFilters({ ...filters, provinceCode, cityCode: undefined })}
              style={{ width: 132 }}
              aria-label="省份"
            />
            <Select
              allowClear
              placeholder="全部城市"
              value={filters.cityCode}
              options={cities.map((item) => ({ label: item.cityName, value: item.cityCode }))}
              onChange={(cityCode) => updateFilters({ ...filters, cityCode })}
              style={{ width: 132 }}
              aria-label="城市"
            />
            <Select
              allowClear
              placeholder="全部状态"
              value={filters.status}
              options={[{ label: '启用', value: 1 }, { label: '停用', value: 0 }]}
              onChange={(status) => updateFilters({ ...filters, status })}
              style={{ width: 112 }}
              aria-label="医院状态"
            />
            {overview?.generatedAt && <span className={styles.updateTime}>生成时间：{overview.generatedAt}</span>}
          </div>
          <div className={styles.toolbarRight}>
            <Button type="primary" loading={loading} onClick={fetchOverview}>刷新</Button>
          </div>
        </div>

        {error && (
          <Alert
            style={{ marginBottom: 16 }}
            type="error"
            showIcon
            message="医院总览加载失败"
            description={error.message}
            action={<Button size="small" onClick={fetchOverview}>重试</Button>}
          />
        )}

        <HospitalOverviewKpis
          summary={overview?.summary ?? { total: 0, oral: 0, plastic: 0, unknown: 0, periodNew: 0 }}
          loading={loading && !overview}
          onSelect={(selection) => applySelection(selection)}
        />

        <HospitalDistributionCard
          byProvince={overview?.byProvince}
          byCity={overview?.byCity}
          byCategory={overview?.byCategory}
          loading={loading && !!overview}
          error={error}
          onSelect={(selection) => applySelection(selection)}
        />

        <Card title="类型经营表现" style={{ marginTop: 16 }}>
          <Table
            size="small"
            rowKey="category"
            dataSource={categoryRows}
            pagination={false}
            locale={{ emptyText: '暂无经营数据' }}
            columns={[
              { title: '类型', dataIndex: 'category', render: (value: HospitalOverviewCategory) => categories.find((item) => item.value === value)?.label ?? value },
              { title: '派单数', dataIndex: 'dispatchCount' },
              { title: '到院数', dataIndex: 'arrivedCount' },
              { title: '成交数', dataIndex: 'dealCount' },
              { title: '到院率', dataIndex: 'arrivedRate', render: (value: number) => `${(value * 100).toFixed(1)}%` },
              { title: '成交率', dataIndex: 'dealRate', render: (value: number) => `${(value * 100).toFixed(1)}%` },
            ]}
          />
          <Space style={{ marginTop: 12 }}>
            <Tag color="gold">未分类医院</Tag>
            <a href="/crm/hospitals?category=unknown">进入医院管理补齐类型</a>
          </Space>
        </Card>
      </div>

      <LegacyCrmDashboardSection />
      <HospitalDrilldownDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} filters={filters} />
      <HospitalCityDrilldownDrawer
        open={cityDrawerOpen}
        onClose={() => setCityDrawerOpen(false)}
        cities={cities}
        onSelectCity={(city) => {
          updateFilters({ ...filters, provinceCode: city.provinceCode, cityCode: city.cityCode });
          setCityDrawerOpen(false);
          setDrawerOpen(true);
        }}
      />
    </PageContainer>
  );
};

export default DashboardPage;
