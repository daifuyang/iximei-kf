import { Button, Empty } from 'antd';
import React from 'react';

interface DashboardEmptyProps {
  message?: string;
  onRefresh?: () => void;
}

/**
 * 数据看板空数据状态。
 * 当所有指标均为零或接口返回空数据时显示。
 */
const DashboardEmpty: React.FC<DashboardEmptyProps> = ({
  message = '暂无数据',
  onRefresh,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 400,
      padding: 48,
    }}
  >
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <div>
          <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.85)', marginBottom: 8 }}>
            {message}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
            完成客户导入后，可查看客户趋势与转化情况
          </div>
        </div>
      }
    >
      {onRefresh && (
        <Button type="primary" onClick={onRefresh}>
          刷新数据
        </Button>
      )}
    </Empty>
  </div>
);

export default DashboardEmpty;
