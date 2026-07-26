import { Button, Result } from 'antd';
import React from 'react';

interface DashboardErrorProps {
  error?: Error | null;
  onRetry?: () => void;
}

/**
 * 数据看板加载失败状态。
 * 显示错误信息并提供重试操作。
 */
const DashboardError: React.FC<DashboardErrorProps> = ({ error, onRetry }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 400,
    }}
  >
    <Result
      status="error"
      title="数据加载失败"
      subTitle={error?.message || '请检查网络连接后重试'}
      extra={
        onRetry && (
          <Button type="primary" onClick={onRetry}>
            重新加载
          </Button>
        )
      }
    />
  </div>
);

export default DashboardError;
