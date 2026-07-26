import { FileTextOutlined } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { Empty, Space, Tag } from 'antd';
import React from 'react';
import type { RecentActivity } from '../types';
import styles from '../index.module.less';

const ACTIVITY_TAG_COLORS: Record<string, string> = {
  '新增': 'blue',
  '派单': 'cyan',
  '成交': 'green',
  '签约': 'purple',
  '到院': 'orange',
};

interface RecentActivityCardProps {
  activities: RecentActivity[];
  loading?: boolean;
}

/**
 * 本期摘要。
 *
 * 汇总当前统计周期的关键数据，非真实操作记录。
 * 展示本期各维度的汇总数字，便于运营人员快速了解本期概况。
 */
const RecentActivityCard: React.FC<RecentActivityCardProps> = ({
  activities,
  loading,
}) => {
  return (
    <ProCard
      title={
        <Space size={8}>
          <FileTextOutlined style={{ color: '#1677FF' }} />
          <span>本期摘要</span>
        </Space>
      }
      loading={loading}
      style={{ height: '100%' }}
      styles={{ body: { padding: '12px 20px 20px' } }}
    >
      {activities.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无摘要数据"
          style={{ padding: '16px 0' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {activities.slice(0, 5).map((item) => (
            <div key={item.id} className={styles.activityItem}>
              <div className={styles.activityMain}>
                <Tag
                  color={ACTIVITY_TAG_COLORS[item.type] || 'default'}
                  className={styles.activityTag}
                >
                  {item.type}
                </Tag>
                <span className={styles.activityDesc}>
                  {item.action} · {item.target}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </ProCard>
  );
};

export default RecentActivityCard;
