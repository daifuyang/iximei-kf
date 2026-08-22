/**
 * 医院数据看板
 *
 * - 由后端提供 /api/crm/v1/hospital/dashboard/stats
 *   返回字段：todayCount / monthCount / yearCount / totalCount / viewedCount / unviewedCount
 * - 由后端提供 /api/crm/v1/hospital/dashboard/trend
 *   返回字段：daily[]（date/count）+ statusBreakdown{viewed, unviewed}
 * - 角色差异：
 *   - hospital_account：固定看本院，无筛选工具栏。
 *   - super_admin：可切换全院/单院 + 日期区间（startDate/endDate）。
 * - 顶部 4 张统计卡（今日/本月/本年/累计派单）
 * - 中部 3 张统计卡（已查看/未查看/查看率%）
 * - 底部 1 个 Row：折线图（派单趋势）+ 饼图（查看状态分布）
 */

import { Line, Pie } from '@ant-design/charts';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, Card, Col, DatePicker, Row, Select, Space, Spin, Statistic, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import { getHospitals, getHospitalDashboardStats, getHospitalDashboardTrend } from '../../api';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface Filters {
  hospitalId?: number;
  startDate?: string;
  endDate?: string;
}

const HospitalDashboard: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const permissions: string[] = initialState?.currentUser?.permissions ?? [];
  const isSuperAdmin = permissions.includes('__super_admin__');

  const [stats, setStats] = useState<any>(null);
  const [trend, setTrend] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [trendError, setTrendError] = useState(false);

  // super_admin 筛选状态
  const [hospitalId, setHospitalId] = useState<number | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [hospitalOptions, setHospitalOptions] = useState<{ label: string; value: number }[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);

  const buildParams = useCallback(
    (): Filters => {
      const params: Filters = {};
      if (hospitalId !== undefined) params.hospitalId = hospitalId;
      if (dateRange) {
        params.startDate = dateRange[0];
        params.endDate = dateRange[1];
      }
      return params;
    },
    [hospitalId, dateRange],
  );

  const loadHospitalOptions = useCallback(async () => {
    if (!isSuperAdmin) return;
    setHospitalsLoading(true);
    try {
      const res = await getHospitals({ page: 1, pageSize: 500, status: 1 });
      const list = (res?.data || []) as any[];
      setHospitalOptions(
        list
          .map((h) => ({ label: h.hospitalName || `医院#${h.id}`, value: Number(h.id) }))
          .sort((a, b) => a.label.localeCompare(b.label, 'zh')),
      );
    } catch {
      setHospitalOptions([]);
    } finally {
      setHospitalsLoading(false);
    }
  }, [isSuperAdmin]);

  const load = useCallback(async () => {
    const params = buildParams();
    setLoading(true);
    try {
      const [sRes, tRes] = await Promise.all([
        getHospitalDashboardStats(params),
        getHospitalDashboardTrend(params),
      ]);
      if (sRes?.success) setStats(sRes.data);
      if (tRes?.success) setTrend(tRes.data);
      setTrendError(false);
    } catch {
      setTrendError(true);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // hospital_account 只加载本院数据；super_admin 加载医院选项 + 数据
  useEffect(() => {
    if (isSuperAdmin) {
      loadHospitalOptions();
      setStats(null);
      setTrend(null);
      load();
    } else {
      setLoading(true);
      getHospitalDashboardStats()
        .then((res: any) => {
          if (res?.success) setStats(res.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
      getHospitalDashboardTrend()
        .then((res: any) => {
          if (res?.success) setTrend(res.data);
        })
        .catch(() => setTrendError(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  // super_admin：筛选条件变化时重新加载
  useEffect(() => {
    if (isSuperAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalId, dateRange]);

  const viewRate =
    stats && stats.totalCount > 0
      ? ((stats.viewedCount / stats.totalCount) * 100).toFixed(1)
      : '0.0';

  return (
    <PageContainer header={{ title: isSuperAdmin ? '医院数据看板' : '本院数据看板' }}>
      {isSuperAdmin && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            <Select
              placeholder="全部医院"
              style={{ width: 200 }}
              allowClear
              value={hospitalId}
              onChange={(v: number | undefined) => setHospitalId(v ?? undefined)}
              options={hospitalOptions}
              showSearch
              optionFilterProp="label"
              loading={hospitalsLoading}
              notFoundContent="暂无医院数据"
              aria-label="医院范围筛选"
            />
            <RangePicker
              allowClear
              value={
                dateRange
                  ? [dayjs(dateRange[0]), dayjs(dateRange[1])]
                  : undefined
              }
              disabledDate={(current) => current?.endOf('day').isAfter(dayjs())}
              onChange={(dates) => {
                if (dates?.[0] && dates?.[1]) {
                  setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
                } else {
                  setDateRange(null);
                }
              }}
              aria-label="自定义时间范围"
            />
            <Text type="secondary">
              统计区间：{dateRange ? `${dateRange[0]} 至 ${dateRange[1]}` : '累计数据'}
            </Text>
          </Space>
        </Card>
      )}

      {!stats && loading ? (
        <Spin />
      ) : (
        <>
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic title="今日派单" value={stats?.todayCount ?? 0} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic title="本月派单" value={stats?.monthCount ?? 0} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic title="本年派单" value={stats?.yearCount ?? 0} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic title="累计派单" value={stats?.totalCount ?? 0} />
              </Card>
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="已查看"
                  value={stats?.viewedCount ?? 0}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="未查看"
                  value={stats?.unviewedCount ?? 0}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="查看率" value={viewRate} suffix="%" />
              </Card>
            </Col>
          </Row>
          {trend && (
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col xs={24} lg={16}>
                <Card title={dateRange ? '派单趋势' : '近 30 天派单趋势'}>
                  <Line
                    data={trend.daily}
                    xField="date"
                    yField="count"
                    height={280}
                    autoFit
                    shapeField="smooth"
                    axis={{
                      x: { title: '日期' },
                      y: { title: '派单数' },
                    }}
                    style={{ stroke: '#1677ff', lineWidth: 2 }}
                    point={{ shapeField: 'circle', sizeField: 4 }}
                    tooltip={{ title: 'date', items: [{ channel: 'y', field: 'count' }] }}
                  />
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card title="查看状态分布">
                  <Pie
                    data={[
                      { type: '已查看', value: trend.statusBreakdown.viewed },
                      { type: '未查看', value: trend.statusBreakdown.unviewed },
                    ].filter((d) => d.value > 0)}
                    angleField="value"
                    colorField="type"
                    radius={0.8}
                    innerRadius={0.5}
                    height={280}
                    legend={{ color: { position: 'bottom' } }}
                    label={{
                      position: 'inside',
                      text: (d: { value: number }) =>
                        `${
                          trend.statusBreakdown.viewed + trend.statusBreakdown.unviewed > 0
                            ? ((d.value / (trend.statusBreakdown.viewed + trend.statusBreakdown.unviewed)) * 100).toFixed(0)
                            : 0
                        }%`,
                    }}
                  />
                </Card>
              </Col>
            </Row>
          )}
          {trendError && !trend && (
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={24}>
                <Card>
                  <Text type="secondary">
                    趋势数据加载失败，请
                    <Button
                      type="link"
                      onClick={() => {
                        setTrendError(false);
                        getHospitalDashboardTrend(buildParams())
                          .then((res: any) => {
                            if (res?.success) setTrend(res.data);
                          })
                          .catch(() => setTrendError(true));
                      }}
                    >
                      重试
                    </Button>
                  </Text>
                </Card>
              </Col>
            </Row>
          )}
        </>
      )}
    </PageContainer>
  );
};

export default HospitalDashboard;
