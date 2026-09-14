import { App, Alert, Col, Row } from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDashboardStats, searchHospitals } from '@/modules/crm/api';
import { GRID_COL } from '../constants';
import type { DashboardFilters, DashboardStats } from '../types';
import { buildFunnelStages, buildHospitalRankings, buildMetrics, buildRecentActivities } from '../utils';
import ConversionFunnelCard from './ConversionFunnelCard';
import CustomerStatusCard from './CustomerStatusCard';
import CustomerTrendCard from './CustomerTrendCard';
import DashboardToolbar from './DashboardToolbar';
import DispatchStatusCard from './DispatchStatusCard';
import HospitalRankingCard from './HospitalRankingCard';
import MetricCards from './MetricCards';
import RecentActivityCard from './RecentActivityCard';

const LegacyCrmDashboardSection: React.FC = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hospitalOptions, setHospitalOptions] = useState<{ label: string; value: number }[]>([]);
  const [selectedHospitalOption, setSelectedHospitalOption] = useState<{ label: string; value: number } | null>(null);
  const [hospitalOptionsLoading, setHospitalOptionsLoading] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>({
    timeRange: '12m',
    startDate: dayjs().subtract(12, 'month').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
  });
  const requestSeqRef = useRef(0);
  const hospitalSearchSeqRef = useRef(0);
  const hospitalSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHospitalSearch = useCallback((keyword: string) => {
    if (hospitalSearchTimerRef.current) clearTimeout(hospitalSearchTimerRef.current);
    const seq = ++hospitalSearchSeqRef.current;
    setHospitalOptionsLoading(true);
    hospitalSearchTimerRef.current = setTimeout(() => {
      searchHospitals(keyword.trim() ? { keyword: keyword.trim() } : {})
        .then((response: any) => {
          if (seq !== hospitalSearchSeqRef.current) return;
          setHospitalOptions((response?.data ?? []).slice(0, 50).map((hospital: any) => ({ label: hospital.hospitalName, value: hospital.id })));
        })
        .catch(() => seq === hospitalSearchSeqRef.current && setHospitalOptions([]))
        .finally(() => seq === hospitalSearchSeqRef.current && setHospitalOptionsLoading(false));
    }, 300);
  }, []);

  useEffect(() => () => {
    hospitalSearchSeqRef.current += 1;
    if (hospitalSearchTimerRef.current) clearTimeout(hospitalSearchTimerRef.current);
  }, []);

  const fetchData = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const response: any = await getDashboardStats({ startDate: filters.startDate, endDate: filters.endDate, hospitalId: filters.hospitalId });
      if (seq !== requestSeqRef.current) return;
      if (!response?.success || !response.data) throw new Error(response?.message || 'Failed to load dashboard');
      setStats(response.data);
    } catch (cause) {
      if (seq === requestSeqRef.current) setError(cause instanceof Error ? cause : new Error('Failed to load dashboard'));
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [filters.hospitalId, filters.endDate, filters.startDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleHospitalChange = useCallback((hospitalId: number | undefined) => {
    setSelectedHospitalOption(hospitalId === undefined ? null : hospitalOptions.find((option) => option.value === hospitalId) ?? null);
    setFilters((current) => ({ ...current, hospitalId }));
  }, [hospitalOptions]);

  const handleRefresh = useCallback(async () => {
    message.loading({ content: 'Refreshing...', key: 'crm-dashboard-refresh', duration: 0 });
    await fetchData();
    message.destroy('crm-dashboard-refresh');
  }, [fetchData, message]);

  const hasPeriodFilter = Boolean(filters.startDate && filters.endDate);
  const metrics = useMemo(() => stats ? buildMetrics(stats, hasPeriodFilter) : [], [hasPeriodFilter, stats]);
  const funnelStages = useMemo(() => stats ? buildFunnelStages(stats) : [], [stats]);
  const activities = useMemo(() => stats ? buildRecentActivities(stats, hasPeriodFilter) : [], [hasPeriodFilter, stats]);
  const hospitalRankings = useMemo(() => stats ? buildHospitalRankings(stats) : [], [stats]);

  return (
    <section aria-label="CRM dashboard" style={{ marginTop: 24 }}>
      {error && <Alert type="error" showIcon message="Dashboard load failed" description={error.message} action={<button type="button" onClick={fetchData}>Retry</button>} style={{ marginBottom: 16 }} />}
      <DashboardToolbar filters={filters} onChange={setFilters} onRefresh={handleRefresh} loading={loading} lastUpdated={stats?.generatedAt} hospitalOptions={hospitalOptions} selectedHospitalOption={selectedHospitalOption} hospitalOptionsLoading={hospitalOptionsLoading} onHospitalSearch={handleHospitalSearch} onHospitalChange={handleHospitalChange} />
      <MetricCards metrics={metrics} loading={loading && !!stats} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col {...GRID_COL.wider}><CustomerTrendCard data={stats?.monthlyTrend?.customers ?? []} loading={loading && !!stats} /></Col>
        <Col {...GRID_COL.narrower}><CustomerStatusCard data={stats?.customerByStatus ?? []} total={hasPeriodFilter ? stats?.customers?.periodNew ?? 0 : stats?.customers?.total ?? 0} loading={loading && !!stats} /></Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col {...GRID_COL.wider}><DispatchStatusCard data={stats?.dispatchByStatus ?? []} loading={loading && !!stats} /></Col>
        <Col {...GRID_COL.narrower}><ConversionFunnelCard stages={funnelStages} loading={loading && !!stats} /></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col {...GRID_COL.half}><RecentActivityCard activities={activities} loading={loading && !!stats} /></Col>
        <Col {...GRID_COL.half}><HospitalRankingCard rankings={hospitalRankings} loading={loading && !!stats} /></Col>
      </Row>
    </section>
  );
};

export default LegacyCrmDashboardSection;
