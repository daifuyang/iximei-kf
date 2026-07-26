/**
 * 数据看板 — CRM 经营分析总览页
 *
 * 负责：
 * 1. 数据获取与状态管理
 * 2. 数据适配（原始 API → UI 数据）
 * 3. 组件编排与栅格布局
 *
 * 各子组件独立处理自身的 loading/empty/error 状态，
 * 单个卡片失败不影响其他卡片。
 */

import { PageContainer } from '@ant-design/pro-components';
import { App, Col, Row } from 'antd';
import dayjs from 'dayjs';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getDashboardStats, searchHospitals } from '../../api';
import BusinessInsightsCard from './components/BusinessInsightsCard';
import ConversionFunnelCard from './components/ConversionFunnelCard';
import CustomerStatusCard from './components/CustomerStatusCard';
import CustomerTrendCard from './components/CustomerTrendCard';
import DashboardEmpty from './components/DashboardEmpty';
import DashboardError from './components/DashboardError';
import DashboardSkeleton from './components/DashboardSkeleton';
import DashboardToolbar from './components/DashboardToolbar';
import DispatchStatusCard from './components/DispatchStatusCard';
import HospitalRankingCard from './components/HospitalRankingCard';
import MetricCards from './components/MetricCards';
import RecentActivityCard from './components/RecentActivityCard';
import { GRID_COL } from './constants';
import styles from './index.module.less';
import type { DashboardFilters, DashboardStats } from './types';
import {
  buildFunnelStages,
  buildHospitalRankings,
  buildMetrics,
  buildRecentActivities,
  generateInsights,
} from './utils';

/* ──────── 主组件 ──────── */

const DashboardPage: React.FC = () => {
  const { message } = App.useApp();

  /* ---------- 状态 ---------- */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hospitalOptions, setHospitalOptions] = useState<
    { label: string; value: number }[]
  >([]);
  const [selectedHospitalOption, setSelectedHospitalOption] = useState<{
    label: string;
    value: number;
  } | null>(null);
  const [hospitalOptionsLoading, setHospitalOptionsLoading] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>({
    timeRange: '12m',
    startDate: dayjs().subtract(12, 'month').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
  });

  // 用于取消过期请求
  const requestSeqRef = useRef(0);
  const hospitalSearchSeqRef = useRef(0);
  const hospitalSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  /* ---------- 医院列表 ---------- */

  const handleHospitalSearch = useCallback((keyword: string) => {
    if (hospitalSearchTimerRef.current) {
      clearTimeout(hospitalSearchTimerRef.current);
    }

    const seq = ++hospitalSearchSeqRef.current;
    const normalizedKeyword = keyword.trim();
    setHospitalOptionsLoading(true);
    hospitalSearchTimerRef.current = setTimeout(() => {
      searchHospitals(normalizedKeyword ? { keyword: normalizedKeyword } : {})
        .then((res: any) => {
          if (seq !== hospitalSearchSeqRef.current) return;
          const list = res?.data ?? [];
          if (Array.isArray(list)) {
            setHospitalOptions(
              list.slice(0, 50).map((hospital: any) => ({
                label: hospital.hospitalName,
                value: hospital.id,
              })),
            );
          }
        })
        .catch(() => {
          if (seq === hospitalSearchSeqRef.current) {
            setHospitalOptions([]);
          }
        })
        .finally(() => {
          if (seq === hospitalSearchSeqRef.current) {
            setHospitalOptionsLoading(false);
          }
        });
    }, 300);
  }, []);

  useEffect(
    () => () => {
      hospitalSearchSeqRef.current += 1;
      if (hospitalSearchTimerRef.current) {
        clearTimeout(hospitalSearchTimerRef.current);
      }
    },
    [],
  );

  const handleHospitalChange = useCallback(
    (hospitalId: number | undefined) => {
      if (hospitalId == null) {
        setSelectedHospitalOption(null);
      } else {
        const option = hospitalOptions.find(
          (item) => item.value === hospitalId,
        );
        if (option) setSelectedHospitalOption(option);
      }
      setFilters((current) => ({ ...current, hospitalId }));
    },
    [hospitalOptions],
  );

  /* ---------- 数据获取 ---------- */

  const fetchData = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = (await getDashboardStats({
        startDate: filters.startDate,
        endDate: filters.endDate,
        hospitalId: filters.hospitalId,
      })) as {
        success: boolean;
        data: DashboardStats;
        message?: string;
      };
      // 忽略过期请求的响应
      if (seq !== requestSeqRef.current) return;
      if (res.success && res.data) {
        setStats(res.data);
      } else {
        throw new Error(res.message || '获取看板数据失败');
      }
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      const e = err instanceof Error ? err : new Error('网络异常');
      setError(e);
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Dashboard] 数据加载失败:', e);
      }
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [filters.startDate, filters.endDate, filters.hospitalId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---------- 数据适配 ---------- */

  // 看板默认也会带近 12 月的起止日期请求；只要存在完整日期范围，
  // 卡片即展示该统计期的数据，而不是容易造成误解的累计存量。
  const hasPeriodFilter = Boolean(filters.startDate && filters.endDate);

  const lastUpdated = useMemo(
    () => stats?.generatedAt ?? dayjs().format('YYYY-MM-DD HH:mm'),
    [stats?.generatedAt],
  );

  const metrics = useMemo(
    () => (stats ? buildMetrics(stats, hasPeriodFilter) : []),
    [stats, hasPeriodFilter],
  );

  const funnelStages = useMemo(
    () => (stats ? buildFunnelStages(stats) : []),
    [stats],
  );

  const insights = useMemo(
    () => (stats ? generateInsights(stats) : []),
    [stats],
  );

  const activities = useMemo(
    () => (stats ? buildRecentActivities(stats, hasPeriodFilter) : []),
    [stats, hasPeriodFilter],
  );

  const hospitalRankings = useMemo(
    () => (stats ? buildHospitalRankings(stats) : []),
    [stats],
  );

  /* ---------- 事件处理 ---------- */

  const handleRefresh = useCallback(() => {
    message.loading({ content: '正在刷新...', key: 'refresh', duration: 0 });
    // 保留旧数据，重新请求
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);
    getDashboardStats({
      startDate: filters.startDate,
      endDate: filters.endDate,
      hospitalId: filters.hospitalId,
    })
      .then((res: any) => {
        if (seq !== requestSeqRef.current) return;
        if (res.success && res.data) {
          setStats(res.data);
          message.success({ content: '数据已刷新', key: 'refresh' });
        } else {
          message.error({ content: res.message || '刷新失败', key: 'refresh' });
        }
      })
      .catch((err: any) => {
        if (seq !== requestSeqRef.current) return;
        message.error({ content: '刷新失败', key: 'refresh' });
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Dashboard] 刷新失败:', err);
        }
      })
      .finally(() => {
        if (seq === requestSeqRef.current) {
          setLoading(false);
        }
      });
  }, [message, filters.startDate, filters.endDate, filters.hospitalId]);

  /* ---------- 状态渲染 ---------- */

  // 首次加载 → 骨架屏
  if (loading && !stats) {
    return (
      <PageContainer>
        <DashboardSkeleton />
      </PageContainer>
    );
  }

  // 加载失败 → 错误页
  if (error && !stats) {
    return (
      <PageContainer>
        <DashboardError error={error} onRetry={fetchData} />
      </PageContainer>
    );
  }

  // 空数据（所有指标均为 0）
  if (stats) {
    const isEmpty =
      stats.hospitals.total === 0 &&
      stats.customers.total === 0 &&
      stats.dispatches.total === 0;
    if (isEmpty) {
      return (
        <PageContainer>
          <DashboardEmpty onRefresh={fetchData} />
        </PageContainer>
      );
    }
  }

  /* ---------- 正常渲染 ---------- */

  return (
    <PageContainer
      header={{
        title: '数据看板',
        subTitle: '展示医院、客户、派单及经营转化的核心数据',
      }}
    >
      <div className={styles.pageContent}>
        {/* 全局筛选工具栏 */}
        <DashboardToolbar
          filters={filters}
          onChange={setFilters}
          onRefresh={handleRefresh}
          loading={loading}
          lastUpdated={lastUpdated}
          hospitalOptions={hospitalOptions}
          selectedHospitalOption={selectedHospitalOption}
          hospitalOptionsLoading={hospitalOptionsLoading}
          onHospitalSearch={handleHospitalSearch}
          onHospitalChange={handleHospitalChange}
        />

        {/* 1. 核心指标卡 */}
        <MetricCards metrics={metrics} loading={loading && !!stats} />

        {/* 2. 客户趋势 + 状态分布 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col {...GRID_COL.wider}>
            <CustomerTrendCard
              data={stats?.monthlyTrend?.customers ?? []}
              loading={loading && !!stats}
            />
          </Col>
          <Col {...GRID_COL.narrower}>
            <CustomerStatusCard
              data={stats?.customerByStatus ?? []}
              total={
                hasPeriodFilter
                  ? (stats?.customers?.periodNew ?? 0)
                  : (stats?.customers?.total ?? 0)
              }
              loading={loading && !!stats}
            />
          </Col>
        </Row>

        {/* 3. 派单状态 + 客户状态结构 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col {...GRID_COL.wider}>
            <DispatchStatusCard
              data={stats?.dispatchByStatus ?? []}
              loading={loading && !!stats}
            />
          </Col>
          <Col {...GRID_COL.narrower}>
            <ConversionFunnelCard
              stages={funnelStages}
              loading={loading && !!stats}
            />
          </Col>
        </Row>

        {/* 4. 经营分析与建议 */}
        <BusinessInsightsCard
          insights={insights}
          loading={loading && !!stats}
        />

        {/* 5. 本期摘要 + 医院效率榜 */}
        <Row gutter={[16, 16]}>
          <Col {...GRID_COL.half}>
            <RecentActivityCard
              activities={activities}
              loading={loading && !!stats}
            />
          </Col>
          <Col {...GRID_COL.half}>
            <HospitalRankingCard
              rankings={hospitalRankings}
              loading={loading && !!stats}
            />
          </Col>
        </Row>
      </div>
    </PageContainer>
  );
};

export default DashboardPage;
