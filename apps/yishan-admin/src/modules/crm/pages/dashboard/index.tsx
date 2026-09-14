import { PageContainer } from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import { Alert, Button, Card, DatePicker, Select, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDashboardCapabilities, getHospitalOverview } from '../../api';
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
  const [canViewOverview, setCanViewOverview] = useState(false);
  useEffect(() => {
    let active = true;
    getDashboardCapabilities().then((response) => {
      if (active) setCanViewOverview(response.success && response.data.hospitalOverview);
    }).catch(() => { if (active) setCanViewOverview(false); });
    return () => { active = false; };
  }, []);
  const [overview, setOverview] = useState<HospitalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cityDrawerOpen, setCityDrawerOpen] = useState(false);
  const [drilldownFilters, setDrilldownFilters] = useState<HospitalOverviewFilters>({});
  const [successfulFilters, setSuccessfulFilters] = useState<HospitalOverviewFilters | null>(null);
  const requestRef = useRef(0);

  const updateFilters = useCallback((next: HospitalOverviewFilters) => {
    setDrawerOpen(false);
    setCityDrawerOpen(false);
    const query = writeFilters(next);
    history.replace(`${location.pathname}${query ? `?${query}` : ''}`);
  }, [location.pathname]);

  const fetchOverview = useCallback(async () => {
    if (!canViewOverview) return;
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await getHospitalOverview(filters);
      if (request !== requestRef.current) return;
      if (!response?.success) throw new Error(response?.message || '获取医院总览失败');
      setOverview(normalizeHospitalOverview(response.data));
      setSuccessfulFilters(filters);
    } catch (cause) {
      if (request !== requestRef.current) return;
      setError(cause instanceof Error ? cause : new Error('获取医院总览失败'));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [canViewOverview, filters]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const stale = !!overview && (loading || !!error || writeFilters(successfulFilters ?? {}) !== writeFilters(filters));
  const applySelection = useCallback((selection: HospitalDistributionSelection, openDrawer = true) => {
    if (!overview || stale) return;
    const next: HospitalOverviewFilters = { ...filters };
    if (selection.category !== undefined) {
      next.category = selection.category;
    }
    if (selection.hospitalScope) next.hospitalScope = selection.hospitalScope;
    if (selection.provinceCode !== undefined) {
      next.provinceCode = selection.provinceCode;
      next.cityCode = selection.cityCode;
    } else if (selection.cityCode !== undefined) {
      next.cityCode = selection.cityCode;
    }
    updateFilters(next);
    setDrilldownFilters(next);
    if (openDrawer) {
      if (selection.provinceCode !== undefined && selection.cityCode === undefined) {
        setCityDrawerOpen(true);
      } else {
        setDrawerOpen(true);
      }
    }
  }, [filters, overview, stale, updateFilters]);

  const cities = useMemo(() => {
    const source = overview?.byCity ?? [];
    return source.filter((item) => filters.provinceCode === undefined || item.provinceCode === filters.provinceCode);
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
        title: canViewOverview ? '医院资源总览' : 'CRM 经营分析',
        subTitle: canViewOverview ? '医院总览与独立经营分析' : undefined,
      }}
    >
      {canViewOverview && <div className={styles.pageContent}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <RangePicker
              value={filters.startDate && filters.endDate ? [dayjs(filters.startDate), dayjs(filters.endDate)] : null}
              onChange={setDateRange}
              aria-label="统计时间范围"
            />
            <Select
              aria-label="医院创建范围"
              value={filters.hospitalScope ?? 'all'}
              options={[{ label: '全部创建时间', value: 'all' }, { label: '本期新增医院', value: 'period-new' }]}
              onChange={(scope) => updateFilters({ ...filters, hospitalScope: scope === 'period-new' ? 'period-new' : undefined })}
              style={{ width: 150 }}
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
            <Button type="primary" loading={loading} onClick={fetchOverview}>刷新医院总览</Button>
          </div>
        </div>

        <p>医院数量按当前医院范围统计；本期新增按医院创建日期统计，业务指标按派单创建日期统计。未选时间时统计累计数据。</p>
        {stale && <Alert type="warning" showIcon message="保留上次成功结果，尚未匹配当前筛选，下钻已停用" />}

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
          disabled={!overview || stale}
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
              { title: '到院率', dataIndex: 'arrivedRate', render: (value: number) => `${value.toFixed(1)}%` },
              { title: '成交率', dataIndex: 'dealRate', render: (value: number) => `${value.toFixed(1)}%` },
            ]}
          />
          <Space style={{ marginTop: 12 }}>
            <Tag color="gold">未分类医院</Tag>
            <a href="/crm/hospitals?category=unknown">进入医院管理补齐类型</a>
          </Space>
        </Card>
      </div>}

      <section aria-label="独立经营分析" style={{ marginTop: 32, borderTop: '2px solid #d9d9d9', paddingTop: 20 }}>
        <h2>独立经营分析</h2>
        <p>以下客户、派单和趋势数据使用本区域的时间和医院筛选，按当前账号授权范围统计；上方医院总览的筛选及刷新不作用于本区域。</p>
        <LegacyCrmDashboardSection />
      </section>
      <HospitalDrilldownDrawer open={canViewOverview && drawerOpen && !stale} onClose={() => setDrawerOpen(false)} filters={drilldownFilters} />
      <HospitalCityDrilldownDrawer
        open={canViewOverview && cityDrawerOpen && !stale}
        onClose={() => setCityDrawerOpen(false)}
        cities={cities}
        onSelectCity={(city) => {
          if (stale) return;
          const next = { ...filters, provinceCode: city.provinceCode, cityCode: city.cityCode };
          updateFilters(next);
          setDrilldownFilters(next);
          setCityDrawerOpen(false);
          setDrawerOpen(true);
        }}
      />
    </PageContainer>
  );
};

export default DashboardPage;
