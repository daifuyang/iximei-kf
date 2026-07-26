import {
  BulbOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { Button, Drawer, Empty, Space } from 'antd';
import React, { useState } from 'react';
import { history } from '@umijs/max';
import type { BusinessInsight, InsightType } from '../types';
import styles from '../index.module.less';

interface BusinessInsightsCardProps {
  insights: BusinessInsight[];
  loading?: boolean;
}

const INSIGHT_META: Record<
  InsightType,
  { icon: React.ReactNode; color: string; className: string }
> = {
  success: {
    icon: <CheckCircleOutlined style={{ color: '#52C41A', fontSize: 16 }} />,
    color: '#52C41A',
    className: styles.insightSuccess,
  },
  warning: {
    icon: <WarningOutlined style={{ color: '#FAAD14', fontSize: 16 }} />,
    color: '#FAAD14',
    className: styles.insightWarning,
  },
  error: {
    icon: <CloseCircleOutlined style={{ color: '#FF4D4F', fontSize: 16 }} />,
    color: '#FF4D4F',
    className: styles.insightError,
  },
  info: {
    icon: <BulbOutlined style={{ color: '#1677FF', fontSize: 16 }} />,
    color: '#1677FF',
    className: styles.insightInfo,
  },
};

/**
 * 经营分析与建议。
 *
 * 按语义类型（success/warning/error/info）展示经营洞察。
 * 默认显示最多 3 条，通过 Drawer 查看全部。
 */
const BusinessInsightsCard: React.FC<BusinessInsightsCardProps> = ({
  insights,
  loading,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const displayInsights = insights.slice(0, 3);

  const renderInsightItem = (insight: BusinessInsight) => {
    const meta = INSIGHT_META[insight.type];
    return (
      <div
        key={insight.id}
        className={`${styles.insightItem} ${meta.className}`}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>{meta.icon}</span>
          <div style={{ flex: 1 }}>
            <div className={styles.insightTitle}>{insight.title}</div>
            <div className={styles.insightContent}>{insight.content}</div>
            {insight.actionText && insight.actionLink && (
              <div className={styles.insightAction}>
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, height: 'auto', color: meta.color }}
                  onClick={() => {
                    if (insight.actionLink) history.push(insight.actionLink);
                  }}
                >
                  {insight.actionText} →
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!insights.length) {
    return (
      <ProCard
        title={
          <Space size={8}>
            <BulbOutlined style={{ color: '#1677FF' }} />
            <span>经营分析与建议</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无经营建议"
          style={{ padding: '16px 0' }}
        />
      </ProCard>
    );
  }

  return (
    <>
      <ProCard
        title={
          <Space size={8}>
            <BulbOutlined style={{ color: '#1677FF' }} />
            <span>经营分析与建议</span>
          </Space>
        }
        extra={
          insights.length > 3 ? (
            <Button type="link" size="small" onClick={() => setDrawerOpen(true)}>
              查看全部建议
            </Button>
          ) : undefined
        }
        loading={loading}
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div className={styles.insightList}>
          {displayInsights.map(renderInsightItem)}
        </div>
      </ProCard>

      {/* 查看全部 Drawer */}
      <Drawer
        title="全部经营建议"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div className={styles.insightList}>
          {insights.map(renderInsightItem)}
        </div>
      </Drawer>
    </>
  );
};

export default BusinessInsightsCard;
