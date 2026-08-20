/**
 * 医院账号本院数据看板
 *
 * - 由 T5 后端提供 /api/crm/v1/hospital/dashboard/stats
 *   返回字段：todayCount / monthCount / yearCount / totalCount / viewedCount / unviewedCount
 * - 由 T3 后端提供 /api/crm/v1/hospital/dashboard/trend
 *   返回字段：daily[]（date/count）+ statusBreakdown{viewed, unviewed}
 * - 顶部 4 张统计卡（今日/本月/本年/累计派单）
 * - 中部 3 张统计卡（已查看/未查看/查看率%）
 * - 底部 1 个 Row：折线图（近 30 天派单趋势）+ 饼图（查看状态分布）
 */

import { Line, Pie } from '@ant-design/charts';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Col, Row, Spin, Statistic, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { getHospitalDashboardStats, getHospitalDashboardTrend } from '../../api';

const { Text } = Typography;

const HospitalDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [trend, setTrend] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [trendError, setTrendError] = useState(false);

  useEffect(() => {
    setLoading(true);
    // 顶部数字卡（已有）
    getHospitalDashboardStats()
      .then((res: any) => {
        if (res?.success) setStats(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // 新增趋势图（独立加载 + 失败降级，不阻塞 stats）
    getHospitalDashboardTrend()
      .then((res: any) => {
        if (res?.success) setTrend(res.data);
      })
      .catch(() => setTrendError(true));
  }, []);

  if (loading || !stats) return <Spin />;

  const viewRate =
    stats.totalCount > 0
      ? ((stats.viewedCount / stats.totalCount) * 100).toFixed(1)
      : '0.0';

  return (
    <PageContainer header={{ title: '本院数据看板' }}>
      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="今日派单" value={stats.todayCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="本月派单" value={stats.monthCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="本年派单" value={stats.yearCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="累计派单" value={stats.totalCount} />
          </Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="已查看"
              value={stats.viewedCount}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="未查看"
              value={stats.unviewedCount}
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
            <Card title="近 30 天派单趋势">
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
                    `${((d.value / (trend.statusBreakdown.viewed + trend.statusBreakdown.unviewed)) * 100).toFixed(0)}%`,
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
                    getHospitalDashboardTrend()
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
    </PageContainer>
  );
};

export default HospitalDashboard;