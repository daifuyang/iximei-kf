/**
 * 我最近查看的派单 — 医院后台首页右下角足迹卡片。
 *
 * 数据来源：crm_dispatch_view_log（医院账号首次进入派单详情时由后端写入）。
 * - hospital_account：本账号访问过的、本院派单
 * - super_admin：本账号访问过的、全院派单
 *
 * 点击「查看」跳到 /crm/dispatches 详情；super_admin 还可换 hospitalId 过滤（卡片无下拉，复用上层筛选）。
 *
 * 任务 4：从派单详情「医院查看状态」段迁来，按第一性原理——
 *   「该医院何时查看了这个派单」的审计信息属于被审计方（医院）,
 *   显示在医院自己的首页更符合第一性原理;super_admin 在派单详情保留的视图日志仍走原路由。
 */
import { EyeOutlined } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Empty, Space, Table } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { getHospitalDashboardMyRecentViews } from '../../../api';

interface RecentView {
  dispatchId: number;
  customerName: string;
  hospitalName: string;
  firstViewedAt: string;
}

const RecentViewedDispatchesCard: React.FC = () => {
  const [items, setItems] = React.useState<RecentView[]>([]);
  const [loading, setLoading] = React.useState(false);
  const { initialState } = useModel('@@initialState');
  const permissions: string[] = initialState?.currentUser?.permissions ?? [];
  const isSuperAdmin = permissions.includes('__super_admin__');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await getHospitalDashboardMyRecentViews({ limit: 10 });
      if (res?.success) setItems(res.data?.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const columns = [
    {
      title: '派单ID',
      dataIndex: 'dispatchId',
      key: 'dispatchId',
      width: 88,
    },
    {
      title: '客户姓名',
      dataIndex: 'customerName',
      key: 'customerName',
      ellipsis: true,
    },
    ...(isSuperAdmin
      ? [
          {
            title: '医院',
            dataIndex: 'hospitalName',
            key: 'hospitalName',
            ellipsis: true,
          },
        ]
      : []),
    {
      title: '查看时间',
      dataIndex: 'firstViewedAt',
      key: 'firstViewedAt',
      width: 160,
      render: (v: string) =>
        v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  return (
    <ProCard
      title={
        <Space size={8}>
          <EyeOutlined style={{ color: '#1677ff' }} />
          <span>我最近查看的派单</span>
        </Space>
      }
      loading={loading}
      style={{ height: '100%' }}
      styles={{ body: { padding: '12px 20px 20px' } }}
    >
      {items.length === 0 ? (
        <div
          style={{
            minHeight: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Empty description="暂无查看记录" />
        </div>
      ) : (
        <Table
          size="small"
          rowKey="dispatchId"
          columns={columns}
          dataSource={items}
          pagination={false}
        />
      )}
    </ProCard>
  );
};

export default RecentViewedDispatchesCard;