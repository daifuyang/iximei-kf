import { Card, Col, Row, Skeleton } from 'antd';
import React from 'react';
import { GRID_COL } from '../constants';
import styles from '../index.module.less';

const SkeletonBlock: React.FC<{ height?: number }> = ({ height = 180 }) => (
  <Card className={styles.skeletonCard} styles={{ body: { padding: 20 } }}>
    <Skeleton active paragraph={{ rows: Math.ceil(height / 28) }} />
  </Card>
);

/**
 * 数据看板首次加载骨架屏。
 * 保持与真实布局一致的栅格结构，避免加载后页面跳动。
 */
const DashboardSkeleton: React.FC = () => (
  <div>
    {/* 工具栏骨架 */}
    <div className={styles.toolbar} style={{ height: 60 }}>
      <Skeleton.Input active size="small" style={{ width: 180 }} />
      <Skeleton.Input active size="small" style={{ width: 240 }} />
    </div>

    {/* 指标卡骨架 */}
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      {[1, 2, 3, 4].map((i) => (
        <Col key={i} {...GRID_COL.metricCard}>
          <SkeletonBlock height={160} />
        </Col>
      ))}
    </Row>

    {/* 图表区骨架 */}
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col {...GRID_COL.wider}>
        <SkeletonBlock height={300} />
      </Col>
      <Col {...GRID_COL.narrower}>
        <SkeletonBlock height={300} />
      </Col>
    </Row>

    {/* 图表区骨架 2 */}
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col {...GRID_COL.wider}>
        <SkeletonBlock height={300} />
      </Col>
      <Col {...GRID_COL.narrower}>
        <SkeletonBlock height={300} />
      </Col>
    </Row>

    {/* 洞察骨架 */}
    <div style={{ marginBottom: 16 }}>
      <SkeletonBlock height={120} />
    </div>

    {/* 底部骨架 */}
    <Row gutter={[16, 16]}>
      <Col {...GRID_COL.half}>
        <SkeletonBlock height={240} />
      </Col>
      <Col {...GRID_COL.half}>
        <SkeletonBlock height={240} />
      </Col>
    </Row>
  </div>
);

export default DashboardSkeleton;
