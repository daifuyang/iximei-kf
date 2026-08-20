/**
 * 医院账号本院数据看板
 *
 * - 由 T5 后端提供 /api/crm/v1/hospital/dashboard/stats
 *   返回字段：todayCount / monthCount / yearCount / totalCount / viewedCount / unviewedCount
 * - 顶部 4 张统计卡（今日/本月/本年/累计派单）
 * - 底部 3 张统计卡（已查看/未查看/查看率%）
 */

import { PageContainer } from '@ant-design/pro-components';
import { Card, Col, Row, Spin, Statistic } from 'antd';
import React, { useEffect, useState } from 'react';
import { getHospitalDashboardStats } from '../../api';

const HospitalDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getHospitalDashboardStats()
      .then((res: any) => {
        if (res?.success) setStats(res.data);
      })
      .finally(() => setLoading(false));
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
    </PageContainer>
  );
};

export default HospitalDashboard;
