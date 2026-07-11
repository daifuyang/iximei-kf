import { PlusOutlined } from '@ant-design/icons';
import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { createHospital, deleteHospital, getHospitals, updateHospital } from '@/services/yishan-admin/crm';

const natureMap: Record<number, string> = { [-1]: '未选择', 0: '民营', 1: '公立' };

const HospitalPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>();
  const [form] = Form.useForm();

  const showForm = (record?: any) => {
    setEditing(record);
    form.setFieldsValue(record || { hospitalNature: -1, status: 1 });
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const res = editing?.id ? await updateHospital(editing.id, values) : await createHospital(values);
    if (res.success) message.success(res.message);
    setOpen(false);
    actionRef.current?.reload();
  };

  const columns: ProColumns<any>[] = [
    { title: 'ID', dataIndex: 'id', search: false, width: 72 },
    { title: '医院名称', dataIndex: 'hospitalName' },
    { title: '绑定账号', dataIndex: ['account', 'username'], search: false },
    { title: '咨询电话', dataIndex: 'hospitalPhone', search: false },
    { title: '营销电话', dataIndex: 'hospitalSelling', search: false },
    { title: '性质', dataIndex: 'hospitalNature', search: false, render: (_, r) => natureMap[r.hospitalNature] || '-' },
    { title: '微信绑定', dataIndex: 'wechatOpenid', search: false, render: (_, r) => (r.wechatOpenid ? <Tag color="green">已绑定</Tag> : <Tag>未绑定</Tag>) },
    { title: '状态', dataIndex: 'status', valueEnum: { 1: { text: '启用', status: 'Success' }, 0: { text: '停用', status: 'Default' } } },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        <a key="edit" onClick={() => showForm(record)}>编辑</a>,
        <Popconfirm key="delete" title="确定删除该医院吗？" onConfirm={async () => {
          const res = await deleteHospital(record.id);
          if (res.success) message.success(res.message);
          actionRef.current?.reload();
        }}>
          <Button type="link" danger>删除</Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        headerTitle="医院管理"
        search={{ labelWidth: 100 }}
        request={async (params) => {
          const res = await getHospitals({ page: params.current, pageSize: params.pageSize, keyword: params.hospitalName, status: params.status });
          return { data: res.data || [], success: res.success, total: res.pagination?.total || 0 };
        }}
        columns={columns}
        toolBarRender={() => [<Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => showForm()}>新建医院</Button>]}
      />
      <Modal title={editing ? '编辑医院' : '新建医院'} open={open} onOk={submit} onCancel={() => setOpen(false)} width={920} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Space align="start" wrap>
            <Form.Item name="hospitalName" label="医院名称" rules={[{ required: true }]}><Input style={{ width: 280 }} /></Form.Item>
            <Form.Item name="accountUserId" label="绑定用户ID"><InputNumber style={{ width: 180 }} /></Form.Item>
            <Form.Item name="status" label="状态"><InputNumber min={0} max={1} style={{ width: 120 }} /></Form.Item>
            <Form.Item name="hospitalNature" label="经营性质"><InputNumber min={-1} max={1} style={{ width: 120 }} /></Form.Item>
          </Space>
          <Space align="start" wrap>
            <Form.Item name="provinceId" label="省ID"><InputNumber /></Form.Item>
            <Form.Item name="cityId" label="市ID"><InputNumber /></Form.Item>
            <Form.Item name="districtId" label="区ID"><InputNumber /></Form.Item>
            <Form.Item name="hospitalAddress" label="详细地址"><Input style={{ width: 360 }} /></Form.Item>
          </Space>
          <Space align="start" wrap>
            <Form.Item name="hospitalPhone" label="咨询电话"><Input /></Form.Item>
            <Form.Item name="hospitalSelling" label="营销电话"><Input /></Form.Item>
            <Form.Item name="hospitalWebsite" label="官网"><Input style={{ width: 280 }} /></Form.Item>
          </Space>
          <Space align="start" wrap>
            <Form.Item name="doctorName" label="就医联系人"><Input /></Form.Item>
            <Form.Item name="doctorPhone" label="就医电话"><Input /></Form.Item>
            <Form.Item name="doctorQq" label="就医QQ"><Input /></Form.Item>
            <Form.Item name="receptionName" label="前台联系人"><Input /></Form.Item>
            <Form.Item name="receptionPhone" label="前台电话"><Input /></Form.Item>
            <Form.Item name="receptionQq" label="前台QQ"><Input /></Form.Item>
          </Space>
          <Space align="start" wrap>
            <Form.Item name="busStation" label="公交站"><Input /></Form.Item>
            <Form.Item name="busAddress" label="公交路线"><Input style={{ width: 280 }} /></Form.Item>
            <Form.Item name="subwayStation" label="地铁站"><Input /></Form.Item>
            <Form.Item name="subwayAddress" label="地铁路线"><Input style={{ width: 280 }} /></Form.Item>
          </Space>
          <Space align="start" wrap>
            <Form.Item name="taxiFare" label="出租车费"><Input /></Form.Item>
            <Form.Item name="vipDiscount" label="会员优惠"><Input style={{ width: 280 }} /></Form.Item>
            <Form.Item name="returnPoint" label="医院返点"><Input /></Form.Item>
          </Space>
          <Form.Item name="hospitalIntroduction" label="医院简介"><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="contractPhotos" label="合同图片JSON"><Input.TextArea rows={2} placeholder='[{"url": "...", "name": "..."}]' /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default HospitalPage;
