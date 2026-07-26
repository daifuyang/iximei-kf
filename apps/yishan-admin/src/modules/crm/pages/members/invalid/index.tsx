import { ReloadOutlined, UndoOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { App, Button, Space, Tag, Popconfirm } from 'antd';
import React, { useRef } from 'react';
import dayjs from 'dayjs';
import { getMembers, restoreMember } from '../../api';

const InvalidMemberPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();

  const columns: ProColumns<any>[] = [
    { title: '会员编号', dataIndex: 'numberId', width: 140 },
    { title: '顾客姓名', dataIndex: 'name', width: 100 },
    { title: '手机号', dataIndex: 'mobile', width: 120, render: (v) => v ? v.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '-' },
    { title: '业务类别', dataIndex: 'businessCategory', width: 100, render: (_, r) => r.businessCategory || '-' },
    { title: '归属客服', dataIndex: ['owner', 'realName'], width: 100, render: (_, r) => r.owner?.realName || r.owner?.username || '-' },
    { title: '作废时间', dataIndex: 'invalidAt', width: 160, valueType: 'dateTime', render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Popconfirm
          title="确认恢复该会员？"
          onConfirm={async () => {
            try {
              const res = await restoreMember(record.id);
              if (res?.success) {
                message.success('恢复成功');
                actionRef.current?.reload();
              }
            } catch (e: any) {
              message.error(e?.message || '恢复失败');
            }
          }}
        >
          <a><UndoOutlined /> 恢复</a>
        </Popconfirm>
      ),
    },
  ];

  return (
    <PageContainer title="作废会员">
      <ProTable<any>
        actionRef={actionRef}
        rowKey="id"
        headerTitle="作废会员列表"
        request={async (params: any) => {
          const { current, pageSize, keyword } = params;
          const res = await getMembers({
            page: current,
            pageSize,
            keyword,
            memberStatus: 'invalid',
          } as any);
          return {
            data: res.data || [],
            success: res.success,
            total: res.pagination?.total || 0,
          };
        }}
        columns={columns}
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => [
          <Button key="refresh" icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>刷新</Button>,
        ]}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
      />
    </PageContainer>
  );
};

export default InvalidMemberPage;
