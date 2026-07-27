import { ProCard } from '@ant-design/pro-components';
import { Empty, Result, Spin } from 'antd';
import React, { type ReactNode } from 'react';

interface ChartCardProps {
  title: ReactNode;
  subtitle?: string;
  extra?: ReactNode;
  loading?: boolean;
  error?: Error | null;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
  height?: number;
  children: ReactNode;
}

/**
 * 图表卡片通用封装。
 *
 * 统一处理 loading / empty / error 三种状态，
 * 所有图表卡片通过此组件包裹以保持一致的外观和交互。
 */
const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  extra,
  loading = false,
  error = null,
  empty = false,
  emptyText = '暂无数据',
  onRetry,
  height,
  children,
}) => {
  const renderContent = () => {
    if (error) {
      return (
        <Result
          status="error"
          title="加载失败"
          subTitle={error.message}
          {...(onRetry
            ? {
                extra: (
                  <a onClick={onRetry} style={{ cursor: 'pointer' }}>
                    重试
                  </a>
                ),
              }
            : {})}
          style={{ padding: '16px 0' }}
        />
      );
    }

    if (empty) {
      return (
        <div
          style={{
            minHeight: height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Empty description={emptyText} />
        </div>
      );
    }

    return (
      <div style={{ position: 'relative', minHeight: height }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1,
              background: 'rgba(255,255,255,0.6)',
            }}
          >
            <Spin />
          </div>
        )}
        <div style={{ opacity: loading ? 0.4 : 1, transition: 'opacity 0.2s' }}>
          {children}
        </div>
      </div>
    );
  };

  return (
    <ProCard
      title={title}
      subTitle={subtitle ? <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', fontWeight: 400 }}>{subtitle}</span> : undefined}
      extra={extra}
      style={{ height: '100%' }}
      styles={{
        header: { padding: '16px 20px 0', borderBottom: 0 },
        body: { padding: '12px 20px 20px' },
      }}
    >
      {renderContent()}
    </ProCard>
  );
};

export default ChartCard;
