/**
 * 派单医院查看日志 — 管理员专用页（独立菜单）。
 *
 * 业务背景：
 * - 此前「医院查看状态」段嵌在派单详情 modal 里（line 491-535），触发 `getDispatchHospitalViewLogs`。
 *   该接口要求 `crm:dispatches:view-hospital-log` perm（仅 super_admin/admin 持有），
 *   医院账号（hospital_account）点「处理」派单会因后端 25005 / 403 在控制台看到权限报错，
 *   且该段在产品上不该给医院账号看。
 * - 拆出来后派单详情 modal 不再请求该接口（hospital_account 0 影响）；
 *   admin 在该独立菜单查看全部派单的医院查看汇总。
 * - 「我最近查看的派单」原挂在 hospital-dashboard 卡片里，按第一性原理挪到本菜单，
 *   让医院账号无需看到该信息，admin 在自己的审计页统一看两类查看记录。
 *
 * 设计要点：
 * - 路由：/crm/admin/dispatch-view-logs，仅 super_admin / admin 通过菜单权限可见。
 * - 页面布局：上方派单列表（已查过 dispatches API）+ 选中行后右侧显示该派单的全部医院查看日志；
 *   顶部常显「我最近查看的派单」卡片，方便 admin 快速跳回刚看过的派单。
 * - 数据来源：复用 dispatches 模块的列表接口 + 单派单 hospital-view-logs 接口 + hospital-dashboard my-recent-views，无新后端 endpoint。
 */

import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { App, Card, Col, Empty, Row, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDispatches,
  getDispatchHospitalViewLogs,
  getHospitalDashboardMyRecentViews,
} from '../../api';

const AdminDispatchViewLogsPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [selectedDispatchId, setSelectedDispatchId] = useState<number | null>(
    null,
  );
  const [viewLogs, setViewLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const loadLogs = useCallback(
    async (dispatchId: number) => {
      setLogsLoading(true);
      try {
        const res: any = await getDispatchHospitalViewLogs(dispatchId);
        if (res?.success) {
          setViewLogs((res.data as any)?.list || []);
        } else {
          message.error(res?.message || '加载医院查看日志失败');
          setViewLogs([]);
        }
      } catch (e: any) {
        message.error(e?.message || '加载医院查看日志失败');
        setViewLogs([]);
      } finally {
        setLogsLoading(false);
      }
    },
    [message],
  );

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const res: any = await getHospitalDashboardMyRecentViews({ limit: 10 });
      if (res?.success) setRecentItems(res.data?.items ?? []);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    if (selectedDispatchId !== null) {
      void loadLogs(selectedDispatchId);
    } else {
      setViewLogs([]);
    }
  }, [selectedDispatchId, loadLogs]);

  const columns: ProColumns<any>[] = [
    { title: '派单 ID', dataIndex: 'id', width: 88 },
    { title: '医院', dataIndex: ['hospital', 'hospitalName'], width: 180 },
    { title: '客户', dataIndex: ['customer', 'name'], width: 120 },
    {
      title: '当前状态',
      dataIndex: ['status', 'name'],
      width: 100,
      render: (_, r) => <Tag color="blue">{r.status?.name || '-'}</Tag>,
    },
    {
      title: '派单时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <a
          onClick={() => setSelectedDispatchId(record.id)}
          style={{
            fontWeight: selectedDispatchId === record.id ? 600 : 400,
          }}
        >
          {selectedDispatchId === record.id ? '已选中' : '查看'}
        </a>
      ),
    },
  ];

  const recentColumns = [
    { title: '派单ID', dataIndex: 'dispatchId', key: 'dispatchId', width: 88 },
    {
      title: '客户姓名',
      dataIndex: 'customerName',
      key: 'customerName',
      ellipsis: true,
    },
    {
      title: '医院',
      dataIndex: 'hospitalName',
      key: 'hospitalName',
      ellipsis: true,
    },
    {
      title: '查看时间',
      dataIndex: 'firstViewedAt',
      key: 'firstViewedAt',
      width: 160,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, r: any) => (
        <a onClick={() => setSelectedDispatchId(r.dispatchId)}>查看</a>
      ),
    },
  ];

  return (
    <PageContainer>
      <Card
        size="small"
        title={
          <Space size={8}>
            <span>我最近查看的派单</span>
            <Tag color="blue">仅管理员可见</Tag>
          </Space>
        }
        loading={recentLoading}
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '8px 16px 16px' } }}
      >
        {recentItems.length === 0 ? (
          <div
            style={{
              minHeight: 100,
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
            columns={recentColumns}
            dataSource={recentItems}
            pagination={false}
          />
        )}
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={selectedDispatchId !== null ? 14 : 24}>
          <ProTable<any>
            actionRef={actionRef}
            rowKey="id"
            headerTitle="派单列表（点行查看医院查看日志）"
            request={async (params) => {
              const res = await getDispatches({
                page: params.current,
                pageSize: params.pageSize,
                keyword: params.keyword,
                statusId: params.statusId,
                startTime: params.startTime,
                endTime: params.endTime,
              });
              return {
                data: res.data || [],
                success: res.success,
                total: res.pagination?.total || 0,
              };
            }}
            columns={columns}
            rowClassName={(record) =>
              selectedDispatchId === record.id ? 'ant-table-row-selected' : ''
            }
            onRow={(record) => ({
              onClick: () => setSelectedDispatchId(record.id),
              style: { cursor: 'pointer' },
            })}
          />
        </Col>
        {selectedDispatchId !== null ? (
          <Col xs={24} lg={10}>
            <Card
              title={`派单 #${selectedDispatchId} 医院查看日志`}
              extra={<a onClick={() => setSelectedDispatchId(null)}>关闭</a>}
              loading={logsLoading}
              styles={{ body: { padding: 0 } }}
            >
              <ProTable
                rowKey="id"
                size="small"
                dataSource={viewLogs}
                search={false}
                options={false}
                pagination={false}
                columns={[
                  { title: '医院', dataIndex: 'hospitalName', width: 140 },
                  {
                    title: '查看账号',
                    dataIndex: 'viewerUsername',
                    width: 100,
                  },
                  {
                    title: '首次查看时间',
                    dataIndex: 'createdAt',
                    valueType: 'dateTime',
                    width: 160,
                  },
                  { title: 'IP', dataIndex: 'ipAddress', width: 130 },
                ]}
              />
            </Card>
          </Col>
        ) : null}
      </Row>
    </PageContainer>
  );
};

export default AdminDispatchViewLogsPage;
