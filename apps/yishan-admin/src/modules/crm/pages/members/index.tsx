import { PlusOutlined, CaretDownOutlined, UserOutlined, PhoneOutlined, TagOutlined, SwapOutlined, StopOutlined, HistoryOutlined, EditOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
  DrawerForm,
  ProFormText,
  ProFormSelect,
  ProFormRadio,
  ProFormTextArea,
  ProFormDatePicker,
  ProFormDateTimePicker,
  ModalForm,
  StatisticCard,
} from '@ant-design/pro-components';
import { App, Button, Card, Col, Row, Space, Tag, Modal, Descriptions, Tabs, Drawer, message, Badge, Input, Table, Form, Divider, Typography, Avatar, Empty, Spin, Dropdown } from 'antd';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  getMembers, getMember, getMemberTags, getSelectableCustomers,
  createMemberFromCustomer, createMemberDirect, updateMember,
  addMemberFollowUp, getMemberFollowUps,
  batchAssignMembers, batchTagMembers, batchInvalidateMembers,
  restoreMember, createMemberTag,
  getMemberOverview,
} from '../../api';
import { getUsers } from '../../api';

const { Text, Title, Paragraph } = Typography;

// ── 常量 ──

const MEMBER_STAGES: Record<string, { text: string; color?: string }> = {
  new: { text: '新会员', color: 'blue' },
  pending_contact: { text: '待联系', color: 'orange' },
  following: { text: '跟进中', color: 'processing' },
  interested: { text: '有意向', color: 'purple' },
  dispatched: { text: '已派单', color: 'geekblue' },
  booked: { text: '已预约', color: 'cyan' },
  visited: { text: '已到院', color: 'lime' },
  converted: { text: '已成交', color: 'green' },
  pending: { text: '暂缓', color: 'gold' },
  lost: { text: '已流失', color: 'default' },
  invalid: { text: '已作废', color: 'default' },
};

const INTENTION_LEVELS: Record<string, { text: string; color?: string }> = {
  high: { text: '高意向', color: 'red' },
  medium: { text: '中意向', color: 'orange' },
  low: { text: '低意向', color: 'blue' },
  unset: { text: '未判断', color: 'default' },
};

const BUSINESS_CATEGORIES = [
  { label: '整形', value: 'plastic' },
  { label: '皮肤', value: 'skin' },
  { label: '口腔', value: 'dental' },
  { label: '植发', value: 'hair' },
  { label: '眼科', value: 'eye' },
  { label: '体检', value: 'checkup' },
];

const FOLLOW_UP_METHODS = [
  { label: '电话', value: 'phone' },
  { label: '微信', value: 'wechat' },
  { label: '短信', value: 'sms' },
  { label: '到店', value: 'visit' },
  { label: '其他', value: 'other' },
];

const FOLLOW_UP_RESULTS = [
  { label: '已联系', value: 'contacted' },
  { label: '未接通', value: 'unreachable' },
  { label: '需要进一步了解', value: 'needs_info' },
  { label: '有明确意向', value: 'interested' },
  { label: '同意派单', value: 'agree_dispatch' },
  { label: '暂不考虑', value: 'not_now' },
  { label: '无效顾客', value: 'invalid' },
];

const SOURCE_CHANNELS = [
  { label: '线上咨询', value: 'online' },
  { label: '电话咨询', value: 'phone' },
  { label: '到店', value: 'visit' },
  { label: '老客介绍', value: 'referral' },
  { label: '广告', value: 'ad' },
  { label: '其他', value: 'other' },
];

// ── 辅助组件 ──

const MemberStageTag: React.FC<{ stage: string }> = ({ stage }) => {
  const cfg = MEMBER_STAGES[stage] || { text: stage, color: 'default' };
  return <Tag color={cfg.color}>{cfg.text}</Tag>;
};

const IntentionLevelTag: React.FC<{ level: string }> = ({ level }) => {
  const cfg = INTENTION_LEVELS[level] || { text: level, color: 'default' };
  return <Tag color={cfg.color}>{cfg.text}</Tag>;
};

const PhoneDisplay: React.FC<{ phone: string }> = ({ phone }) => {
  if (!phone) return <span>-</span>;
  const masked = phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  return <span title={phone}>{masked}</span>;
};

// ── 概览 hook ──

function useMemberOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await getMemberOverview();
      if (seq !== seqRef.current) return; // stale
      if (res?.success) {
        setData(res.data);
      } else {
        setError(res?.message ?? '加载失败');
      }
    } catch (e: any) {
      if (seq !== seqRef.current) return;
      setError(e?.message ?? '加载失败');
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

// ── 主页面 ──

const MemberPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();

  // State
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('basic');
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [invalidateOpen, setInvalidateOpen] = useState(false);
  const [batchAssignOpen, setBatchAssignOpen] = useState(false);
  const [batchTagOpen, setBatchTagOpen] = useState(false);
  const [createTagOpen, setCreateTagOpen] = useState(false);

  const [editingMember, setEditingMember] = useState<any>(null);
  const [detailMember, setDetailMember] = useState<any>(null);
  const [currentMember, setCurrentMember] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  // ── 快捷筛选预设状态 ──
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [tableParams, setTableParams] = useState<any>({});

  // 当前用户 ID（从页面上下文中获取，简化处理用 localStorage 里的用户信息）
  const currentUserId = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user-info') || '{}')?.userId;
    } catch { return undefined; }
  }, []);

  // Create form state
  const [createMode, setCreateMode] = useState<'from_customer' | 'direct'>('from_customer');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearchResult, setCustomerSearchResult] = useState<any[]>([]);
  const [customerSearchTotal, setCustomerSearchTotal] = useState(0);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerKeyword, setCustomerKeyword] = useState('');

  // ── 概览（独立接口，不与列表推导） ──

  const overview = useMemberOverview();

  // ── 对操作成功的统一回调 ──

  const reloadAll = useCallback(() => {
    reloadAll();
    overview.reload();
  }, [overview]);

  // ── 加载用户列表 ──

  const loadUsers = useCallback(async () => {
    try {
      const res = await getUsers({ pageSize: 100 });
      if (res?.data) setUsers(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const res = await getMemberTags();
      if (res?.data) setTags(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadUsers(); loadTags(); }, [loadUsers, loadTags]);

  // ── 客户搜索 ──

  const searchCustomers = useCallback(async (keyword: string, page = 1) => {
    setCustomerSearchLoading(true);
    try {
      const res = await getSelectableCustomers({ keyword, page, pageSize: 10 });
      if (res?.success) {
        setCustomerSearchResult(res.data || []);
        setCustomerSearchTotal(res.pagination?.total || 0);
      }
    } catch { /* */ }
    setCustomerSearchLoading(false);
  }, []);

  // ── 表格列定义 ──

  const columns: ProColumns<any>[] = [
    {
      title: '会员编号',
      dataIndex: 'numberId',
      width: 140,
      ellipsis: true,
      render: (_, r) => <a onClick={() => handleViewDetail(r)}>{r.numberId}</a>,
    },
    {
      title: '顾客',
      dataIndex: 'name',
      width: 120,
      render: (_, r) => (
        <div>
          <div>{r.name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.gender === 1 ? '男' : r.gender === 2 ? '女' : ''}
            {r.birthday ? ` · ${dayjs().diff(dayjs(r.birthday), 'year')}岁` : ''}
          </Text>
        </div>
      ),
    },
    {
      title: '联系方式',
      dataIndex: 'mobile',
      width: 120,
      search: false,
      render: (v) => <PhoneDisplay phone={String(v ?? '')} />,
    },
    {
      title: '业务意向',
      dataIndex: 'businessCategory',
      width: 140,
      valueType: 'select',
      valueEnum: Object.fromEntries(BUSINESS_CATEGORIES.map(c => [c.value, { text: c.label }])),
      render: (_, r) => (
        <div>
          {r.businessCategory ? (
            <Tag>{BUSINESS_CATEGORIES.find(c => c.value === r.businessCategory)?.label || r.businessCategory}</Tag>
          ) : <span>-</span>}
          <div style={{ fontSize: 12, color: '#999' }}>{r.intentionProject || ''}</div>
        </div>
      ),
    },
    {
      title: '当前阶段',
      dataIndex: 'memberStage',
      width: 100,
      valueType: 'select',
      valueEnum: Object.fromEntries(Object.entries(MEMBER_STAGES).map(([k, v]) => [k, { text: v.text }])),
      render: (_, r) => <MemberStageTag stage={r.memberStage} />,
    },
    {
      title: '意向等级',
      dataIndex: 'intentionLevel',
      width: 90,
      valueType: 'select',
      valueEnum: Object.fromEntries(Object.entries(INTENTION_LEVELS).map(([k, v]) => [k, { text: v.text }])),
      render: (_, r) => <IntentionLevelTag level={r.intentionLevel} />,
    },
    {
      title: '归属客服',
      dataIndex: 'ownerUserId',
      width: 100,
      valueType: 'select',
      hideInTable: true,
      fieldProps: { options: users.map((u: any) => ({ label: u.realName || u.username, value: u.id })) },
    },
    {
      title: '归属客服',
      dataIndex: ['owner', 'realName'],
      width: 100,
      search: false,
      render: (_, r) => r.owner?.realName || r.owner?.username || '-',
    },
    {
      title: '来源渠道',
      dataIndex: 'sourceChannel',
      width: 100,
      valueType: 'select',
      valueEnum: Object.fromEntries(SOURCE_CHANNELS.map(c => [c.value, { text: c.label }])),
      hideInTable: true,
    },
    {
      title: '跟进时间范围',
      dataIndex: 'nextFollowUpRange',
      width: 160,
      valueType: 'dateTimeRange',
      hideInTable: true,
      search: { transform: (v: any) => ({ nextFollowUpStart: v?.[0], nextFollowUpEnd: v?.[1] }) },
    },
    {
      title: '创建时间范围',
      dataIndex: 'createdTimeRange',
      width: 160,
      valueType: 'dateTimeRange',
      hideInTable: true,
      search: { transform: (v: any) => ({ createdStart: v?.[0], createdEnd: v?.[1] }) },
    },
    {
      title: '是否逾期',
      dataIndex: 'isOverdue',
      width: 80,
      valueType: 'select',
      valueEnum: { 1: { text: '已逾期' } },
      hideInTable: true,
    },
    {
      title: '最近跟进',
      dataIndex: 'lastFollowUpAt',
      width: 150,
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '下次跟进',
      dataIndex: 'nextFollowUpAt',
      width: 150,
      search: false,
      valueType: 'dateTime',
      render: (_, r) => {
        if (!r.nextFollowUpAt) return <span>-</span>;
        const isOverdue = dayjs(r.nextFollowUpAt).isBefore(dayjs());
        return (
          <span style={{ color: isOverdue ? '#ff4d4f' : undefined }}>
            {isOverdue && <Badge status="error" />}
            {dayjs(r.nextFollowUpAt).format('YYYY-MM-DD HH:mm')}
          </span>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 180,
      render: (_, record) => [
        <a key="detail" onClick={() => handleViewDetail(record)}>详情</a>,
        <a key="follow" onClick={() => handleOpenFollowUp(record)}>跟进</a>,
        <Dropdown
          key="more"
          menu={{
            items: [
              { key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => handleEdit(record) },
              { key: 'dispatch', label: '创建派单', icon: <SwapOutlined />, onClick: () => handleDispatch(record) },
              { key: 'assign', label: '转交客服', icon: <SwapOutlined />, onClick: () => { setCurrentMember(record); setBatchAssignOpen(true); } },
              { key: 'tag', label: '添加标签', icon: <TagOutlined />, onClick: () => { setCurrentMember(record); setBatchTagOpen(true); } },
              { type: 'divider' },
              { key: 'invalidate', label: '作废会员', icon: <StopOutlined />, danger: true, onClick: () => { setCurrentMember(record); setInvalidateOpen(true); } },
            ],
          }}
        >
          <a>
            更多 <CaretDownOutlined />
          </a>
        </Dropdown>,
      ],
    },
  ];

  // ── 操作处理 ──

  const handleViewDetail = async (record: any) => {
    const res = await getMember(record.id);
    if (res?.success) {
      setDetailMember(res.data);
      setDetailTab('basic');
      setDetailOpen(true);
    }
  };

  const handleEdit = (record: any) => {
    setEditingMember(record);
    setEditOpen(true);
  };

  const handleOpenFollowUp = (record: any) => {
    setCurrentMember(record);
    setFollowUpOpen(true);
  };

  const handleDispatch = async (record: any) => {
    // Open a simple dispatch modal
    handleOpenFollowUp(record);
  };

  // ── 创建会员 ──

  const handleCreate = async (values: any) => {
    try {
      let res: any;
      if (createMode === 'from_customer') {
        if (!selectedCustomer) {
          message.error('请选择客户');
          return;
        }
        res = await createMemberFromCustomer({
          customerId: selectedCustomer.id,
          ...values,
        });
      } else {
        res = await createMemberDirect(values);
      }
      if (res?.success) {
        message.success('创建成功');
        setCreateOpen(false);
        setSelectedCustomer(null);
        reloadAll();
      } else {
        message.error(res?.message || '创建失败');
      }
    } catch (e: any) {
      message.error(e?.message || '创建失败');
    }
  };

  const handleUpdate = async (values: any) => {
    try {
      const res = await updateMember(editingMember.id, values);
      if (res?.success) {
        message.success('修改成功');
        setEditOpen(false);
        reloadAll();
      } else {
        message.error(res?.message || '修改失败');
      }
    } catch (e: any) {
      message.error(e?.message || '修改失败');
    }
  };

  const handleFollowUp = async (values: any) => {
    try {
      const res = await addMemberFollowUp(currentMember.id, values);
      if (res?.success) {
        message.success('跟进记录已保存');
        setFollowUpOpen(false);
        reloadAll();
        // If result is agree_dispatch, prompt to create dispatch
        if (values.result === 'agree_dispatch') {
          Modal.confirm({
            title: '跟进记录已保存，是否立即创建派单？',
            okText: '创建派单',
            cancelText: '暂不派单',
            onOk: async () => {
              // Open dispatch creation
              message.info('请前往详情创建派单');
              setCurrentMember(currentMember);
              const res2 = await getMember(currentMember.id);
              if (res2?.success) {
                setDetailMember(res2.data);
                setDetailTab('basic');
                setDetailOpen(true);
              }
            },
          });
        }
      } else {
        message.error(res?.message || '保存失败');
      }
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    }
  };

  const handleInvalidate = async () => {
    const ids = selectedRowKeys.length > 0 ? selectedRowKeys : currentMember ? [currentMember.id] : [];
    try {
      const res = await batchInvalidateMembers({ memberIds: ids });
      if (res?.success) {
        message.success('操作成功');
        setInvalidateOpen(false);
        setSelectedRowKeys([]);
        reloadAll();
      }
    } catch (e: any) {
      message.error(e?.message || '操作失败');
    }
  };

  const handleRestore = async (id: number) => {
    try {
      const res = await restoreMember(id);
      if (res?.success) {
        message.success('恢复成功');
        if (detailOpen) setDetailOpen(false);
        reloadAll();
      }
    } catch (e: any) {
      message.error(e?.message || '恢复失败');
    }
  };

  const handleBatchAssign = async (values: any) => {
    const ids = selectedRowKeys.length > 0 ? selectedRowKeys : currentMember ? [currentMember.id] : [];
    try {
      const res = await batchAssignMembers({ memberIds: ids, toUserId: values.toUserId, reason: values.reason });
      if (res?.success) {
        message.success('分配成功');
        setBatchAssignOpen(false);
        setSelectedRowKeys([]);
        reloadAll();
      }
    } catch (e: any) {
      message.error(e?.message || '分配失败');
    }
  };

  const handleBatchTag = async (values: any) => {
    const ids = selectedRowKeys.length > 0 ? selectedRowKeys : currentMember ? [currentMember.id] : [];
    try {
      const res = await batchTagMembers({ memberIds: ids, tagIds: values.tagIds });
      if (res?.success) {
        message.success('打标签成功');
        setBatchTagOpen(false);
        setSelectedRowKeys([]);
        reloadAll();
      }
    } catch (e: any) {
      message.error(e?.message || '打标签失败');
    }
  };

  // ── 渲染 ──

  return (
    <PageContainer
      title="会员顾客"
      subTitle="统一管理会员资料、跟进阶段、业务意向与转化进度"
    >
      {/* 概览卡片 — 可点击进入对应待办列表 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="待办跟进"
            loading={overview.loading}
            statistic={{
              value: overview.data?.pendingFollowUp ?? '-',
              suffix: (
                <span style={{ fontSize: 14, fontWeight: 400 }}>
                  {overview.data?.overdueFollowUp > 0
                    ? <span style={{ color: '#ff4d4f' }}>{' '}逾期 {overview.data.overdueFollowUp}</span>
                    : ''}
                </span>
              ),
            }}
            hoverable
            onClick={() => { setActivePreset('pending'); setTableParams({ nextFollowUpEnd: dayjs().format('YYYY-MM-DDTHH:mm:ss') + 'Z' }); }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="今日新增"
            loading={overview.loading}
            statistic={{ value: overview.data?.todayNew ?? '-', suffix: '人' }}
            hoverable
            onClick={() => {
              const today = dayjs().format('YYYY-MM-DD');
              setActivePreset('todayNew');
              setTableParams({ createdStart: `${today}T00:00:00Z`, createdEnd: `${today}T23:59:59Z` });
            }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="本月已派单"
            loading={overview.loading}
            statistic={{ value: overview.data?.monthDispatched ?? '-', suffix: '人' }}
            hoverable
            onClick={() => { setActivePreset('dispatched'); setTableParams({ stage: 'dispatched' }); }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="成交转化率"
            loading={overview.loading}
            statistic={{
              value: overview.data?.monthConversionRate != null ? `${overview.data.monthConversionRate}%` : '-',
              suffix: (
                <span style={{ fontSize: 14, fontWeight: 400 }}>
                  成交 {overview.data?.monthConverted ?? 0}/{overview.data?.monthDispatched ?? 0}
                </span>
              ),
            }}
            hoverable
            onClick={() => { setActivePreset('converted'); setTableParams({ stage: 'converted' }); }}
          />
        </Col>
      </Row>

      {/* 快捷筛选预设 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <Button
            type={activePreset === null ? 'primary' : 'default'}
            size="small"
            onClick={() => { setActivePreset(null); setTableParams({}); }}
          >
            全部会员
            {overview.data?.total != null && <span style={{ fontWeight: 400, marginLeft: 4 }}>({overview.data.total})</span>}
          </Button>
          <Button
            type={activePreset === 'mine' ? 'primary' : 'default'}
            size="small"
            onClick={() => { setActivePreset('mine'); setTableParams({ ownerUserId: currentUserId }); }}
          >
            我的会员
          </Button>
          <Badge count={overview.data?.pendingFollowUp ?? 0} size="small" offset={[4, -2]}>
            <Button
              type={activePreset === 'pending' ? 'primary' : 'default'}
              size="small"
              onClick={() => { setActivePreset('pending'); setTableParams({ nextFollowUpEnd: dayjs().format('YYYY-MM-DDTHH:mm:ss') + 'Z' }); }}
            >
              今日待跟进
            </Button>
          </Badge>
          <Badge count={overview.data?.overdueFollowUp ?? 0} size="small" offset={[4, -2]}>
            <Button
              type={activePreset === 'overdue' ? 'primary' : 'default'}
              size="small"
              danger={overview.data?.overdueFollowUp > 0}
              onClick={() => { setActivePreset('overdue'); setTableParams({ isOverdue: 1 }); }}
            >
              已逾期
            </Button>
          </Badge>
          <Button
            type={activePreset === 'weekNew' ? 'primary' : 'default'}
            size="small"
            onClick={() => {
              const start = dayjs().startOf('week').format('YYYY-MM-DDTHH:mm:ss') + 'Z';
              const end = dayjs().endOf('week').format('YYYY-MM-DDTHH:mm:ss') + 'Z';
              setActivePreset('weekNew'); setTableParams({ createdStart: start, createdEnd: end });
            }}
          >
            本周新增
          </Button>
        </div>
      </Card>

      {/* 主表格 */}
      <ProTable<any>
        actionRef={actionRef}
        rowKey="id"
        headerTitle="会员顾客列表"
        search={{
          labelWidth: 120,
          defaultCollapsed: false,
          collapseRender: (collapsed) => (collapsed ? '展开筛选' : '收起筛选'),
        }}
        params={tableParams}
        request={async (params: any) => {
          const { current, pageSize, keyword, stage, businessCategory, intentionLevel, ownerUserId, sourceChannel, nextFollowUpStart, nextFollowUpEnd, createdStart, createdEnd, isOverdue, ...rest } = params;
          // Reset preset when manual search changes
          if (Object.keys(rest).length > 0 && rest._resetPreset !== false) {
            setActivePreset(null);
          }
          const res = await getMembers({
            page: current,
            pageSize,
            keyword: keyword || undefined,
            stage: stage || undefined,
            businessCategory: businessCategory || undefined,
            intentionLevel: intentionLevel || undefined,
            ownerUserId: ownerUserId || undefined,
            sourceChannel: sourceChannel || undefined,
            nextFollowUpStart: nextFollowUpStart || undefined,
            nextFollowUpEnd: nextFollowUpEnd || undefined,
            createdStart: createdStart || undefined,
            createdEnd: createdEnd || undefined,
            isOverdue: isOverdue || undefined,
          });
          return {
            data: res.data || [],
            success: res.success,
            total: res.pagination?.total || 0,
          };
        }}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys: any) => setSelectedRowKeys(keys),
        }}
        tableAlertRender={({ selectedRowKeys: keys, selectedRows }) => {
          const hasInvalid = selectedRows.some((r: any) => r.memberStatus === 'invalid');
          return (
            <Space>
              <span>已选择 {keys.length} 项</span>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
              <Button size="small" onClick={() => setBatchAssignOpen(true)}>批量分配</Button>
              <Button size="small" onClick={() => setBatchTagOpen(true)}>批量打标签</Button>
              <Button size="small" danger onClick={() => setInvalidateOpen(true)} disabled={hasInvalid}>作废会员</Button>
            </Space>
          );
        }}
        toolBarRender={() => [
          <Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => { setCreateMode('from_customer'); setSelectedCustomer(null); setCreateOpen(true); }}>
            新增
          </Button>,
        ]}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showQuickJumper: true,
        }}
      />

      {/* 新增会员 Drawer */}
      <DrawerForm
        title="新增会员顾客"
        open={createOpen}
        onOpenChange={setCreateOpen}
        width={640}
        drawerProps={{ destroyOnClose: true }}
        onFinish={handleCreate}
        submitter={{
          submitButtonProps: { title: '创建会员' },
          resetButtonProps: { title: '取消' },
          render: (props: any, doms: any) => {
            return [
              <Button key="cancel" onClick={() => { if (props.form?.isFieldsTouched()) {
                Modal.confirm({ title: '当前内容尚未保存，确认放弃吗？', okText: '确认放弃', cancelText: '继续编辑', onOk: () => setCreateOpen(false) });
              } else { setCreateOpen(false); }}}>取消</Button>,
              <Button key="submit" type="primary" loading={props.submitting} onClick={() => props.form?.submit()}>创建会员</Button>,
            ];
          },
        }}
      >
        <ProFormRadio.Group
          name="createMode"
          label="选择来源"
          initialValue="from_customer"
          options={[
            { label: '从客户转会员', value: 'from_customer' },
            { label: '直接新增会员', value: 'direct' },
          ]}
          fieldProps={{
            onChange: (e: any) => {
              setCreateMode(e.target.value);
              setSelectedCustomer(null);
            },
          }}
        />

        {createMode === 'from_customer' ? (
          <>
            <Divider>选择客户</Divider>
            {!selectedCustomer ? (
              <>
                <Input.Search
                  placeholder="搜索客户姓名、手机号、客户编号"
                  enterButton="搜索"
                  loading={customerSearchLoading}
                  onSearch={(val) => { setCustomerKeyword(val); searchCustomers(val); }}
                />
                <div style={{ marginTop: 12, maxHeight: 300, overflow: 'auto' }}>
                  {customerSearchResult.length > 0 ? (
                    <Table
                      dataSource={customerSearchResult}
                      rowKey="id"
                      size="small"
                      pagination={{
                        simple: true,
                        total: customerSearchTotal,
                        pageSize: 10,
                        onChange: (p) => searchCustomers(customerKeyword, p),
                      }}
                      columns={[
                        { title: '客户编号', dataIndex: 'numberId', width: 120 },
                        { title: '姓名', dataIndex: 'name', width: 80 },
                        { title: '手机号', dataIndex: 'mobile', width: 110, render: (v) => <PhoneDisplay phone={v} /> },
                        { title: '状态', dataIndex: 'statusId', width: 80 },
                        { title: '操作', width: 80, render: (_, r) => <a onClick={() => setSelectedCustomer(r)}>选择</a> },
                      ]}
                    />
                  ) : (
                    customerSearchLoading ? null : <Empty description="请输入关键词搜索客户" />
                  )}
                </div>
              </>
            ) : (
              <Card size="small" title="已选客户" extra={<a onClick={() => setSelectedCustomer(null)}>重新选择</a>}>
                <Descriptions size="small" column={2}>
                  <Descriptions.Item label="姓名">{selectedCustomer.name}</Descriptions.Item>
                  <Descriptions.Item label="手机号"><PhoneDisplay phone={selectedCustomer.mobile} /></Descriptions.Item>
                  <Descriptions.Item label="客户编号">{selectedCustomer.numberId}</Descriptions.Item>
                  <Descriptions.Item label="来源渠道">{selectedCustomer.sourceChannel}</Descriptions.Item>
                  <Descriptions.Item label="归属客服">{selectedCustomer.owner?.realName || selectedCustomer.owner?.username || '-'}</Descriptions.Item>
                </Descriptions>
              </Card>
            )}
            <Divider>会员信息</Divider>
            <ProFormSelect name="businessCategory" label="业务类别" options={BUSINESS_CATEGORIES} rules={[{ required: true }]} placeholder="请选择" />
            <ProFormText name="intentionProject" label="意向项目" placeholder="请输入" />
            <ProFormSelect name="memberStage" label="当前阶段" initialValue="new" options={Object.entries(MEMBER_STAGES).map(([k, v]) => ({ label: v.text, value: k }))} rules={[{ required: true }]} />
            <ProFormSelect name="intentionLevel" label="意向等级" initialValue="unset" options={Object.entries(INTENTION_LEVELS).map(([k, v]) => ({ label: v.text, value: k }))} />
            <ProFormText name="budgetRange" label="预算范围" placeholder="例如：1-3万" />
            <ProFormDatePicker name="expectedDate" label="期望时间" />
            <ProFormSelect name="ownerUserId" label="归属客服" options={users.map((u: any) => ({ label: u.realName || u.username, value: u.id }))} rules={[{ required: true }]} />
            <ProFormSelect name="tagIds" label="顾客标签" mode="multiple" options={tags.map((t: any) => ({ label: t.name, value: t.id }))} />
            <ProFormTextArea name="firstContactRecord" label="首次沟通记录" placeholder="输入首次沟通内容" />
            <ProFormDateTimePicker name="nextFollowUpAt" label="下次跟进时间" />
            <ProFormTextArea name="remark" label="备注" />
          </>
        ) : (
          <>
            <Divider>基本资料</Divider>
            <ProFormText name="name" label="顾客姓名" rules={[{ required: true, max: 50 }]} placeholder="请输入姓名" />
            <ProFormText name="mobile" label="手机号" rules={[{ required: true, pattern: /^1\d{10}$/, message: '请输入正确的手机号' }]} placeholder="请输入手机号" />
            <ProFormText name="wechat" label="微信号" placeholder="请输入微信号" />
            <ProFormRadio.Group name="gender" label="性别" options={[{ label: '男', value: 1 }, { label: '女', value: 2 }, { label: '未知', value: 0 }]} initialValue={0} />
            <ProFormDatePicker name="birthday" label="出生日期" />
            <ProFormSelect name="sourceChannel" label="来源渠道" options={SOURCE_CHANNELS} />
            <ProFormSelect name="cityId" label="所在城市" />
            <Divider>会员信息</Divider>
            <ProFormSelect name="businessCategory" label="业务类别" options={BUSINESS_CATEGORIES} rules={[{ required: true }]} placeholder="请选择" />
            <ProFormText name="intentionProject" label="意向项目" placeholder="请输入" />
            <ProFormSelect name="memberStage" label="当前阶段" initialValue="new" options={Object.entries(MEMBER_STAGES).map(([k, v]) => ({ label: v.text, value: k }))} rules={[{ required: true }]} />
            <ProFormSelect name="intentionLevel" label="意向等级" initialValue="unset" options={Object.entries(INTENTION_LEVELS).map(([k, v]) => ({ label: v.text, value: k }))} />
            <ProFormText name="budgetRange" label="预算范围" placeholder="例如：1-3万" />
            <ProFormDatePicker name="expectedDate" label="期望时间" />
            <ProFormSelect name="ownerUserId" label="归属客服" options={users.map((u: any) => ({ label: u.realName || u.username, value: u.id }))} rules={[{ required: true }]} />
            <ProFormSelect name="tagIds" label="顾客标签" mode="multiple" options={tags.map((t: any) => ({ label: t.name, value: t.id }))} />
            <Divider>跟进安排</Divider>
            <ProFormTextArea name="firstContactRecord" label="首次沟通记录" placeholder="输入首次沟通内容" />
            <ProFormDateTimePicker name="nextFollowUpAt" label="下次跟进时间" />
            <ProFormTextArea name="remark" label="备注" />
          </>
        )}
      </DrawerForm>

      {/* 编辑会员 Drawer */}
      <DrawerForm
        title="编辑会员顾客"
        open={editOpen}
        onOpenChange={setEditOpen}
        width={640}
        drawerProps={{ destroyOnClose: true }}
        onFinish={handleUpdate}
        initialValues={editingMember ? {
          ...editingMember,
          tagIds: editingMember.tags?.map((t: any) => t.id) || [],
        } : undefined}
      >
        {editingMember && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Descriptions size="small" column={3}>
              <Descriptions.Item label="会员编号">{editingMember.numberId}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(editingMember.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="最近跟进">{editingMember.lastFollowUpAt ? dayjs(editingMember.lastFollowUpAt).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}
        <Divider>基本资料</Divider>
        <ProFormText name="name" label="姓名" rules={[{ max: 50 }]} placeholder="请输入" />
        <ProFormText name="mobile" label="手机号" rules={[{ pattern: /^1\d{10}$/, message: '请输入正确的手机号' }]} placeholder="请输入" />
        <ProFormText name="wechat" label="微信号" />
        <ProFormRadio.Group name="gender" label="性别" options={[{ label: '男', value: 1 }, { label: '女', value: 2 }, { label: '未知', value: 0 }]} />
        <ProFormDatePicker name="birthday" label="出生日期" />
        <ProFormSelect name="sourceChannel" label="来源渠道" options={SOURCE_CHANNELS} />
        <Divider>会员信息</Divider>
        <ProFormSelect name="businessCategory" label="业务类别" options={BUSINESS_CATEGORIES} />
        <ProFormText name="intentionProject" label="意向项目" />
        <ProFormSelect name="memberStage" label="当前阶段" options={Object.entries(MEMBER_STAGES).map(([k, v]) => ({ label: v.text, value: k }))} />
        <ProFormSelect name="intentionLevel" label="意向等级" options={Object.entries(INTENTION_LEVELS).map(([k, v]) => ({ label: v.text, value: k }))} />
        <ProFormText name="budgetRange" label="预算范围" />
        <ProFormDatePicker name="expectedDate" label="期望时间" />
        <ProFormSelect name="ownerUserId" label="归属客服" options={users.map((u: any) => ({ label: u.realName || u.username, value: u.id }))} />
        <ProFormSelect name="tagIds" label="顾客标签" mode="multiple" options={tags.map((t: any) => ({ label: t.name, value: t.id }))} />
        <Divider>跟进安排</Divider>
        <ProFormDateTimePicker name="nextFollowUpAt" label="下次跟进时间" />
        <ProFormTextArea name="remark" label="备注" />
      </DrawerForm>

      {/* 会员详情 Drawer */}
      <Drawer
        title="会员顾客详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={800}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => { if (detailMember) handleEdit(detailMember); }}>编辑</Button>
            <Button onClick={() => { if (detailMember) handleOpenFollowUp(detailMember); }}>添加跟进</Button>
            {detailMember?.memberStatus === 'invalid' && (
              <Button onClick={() => handleRestore(detailMember.id)}>恢复会员</Button>
            )}
          </Space>
        }
      >
        {detailMember && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={24} align="middle">
                <Col flex="auto">
                  <Space>
                    <Avatar size={48} icon={<UserOutlined />} />
                    <div>
                      <Title level={4} style={{ margin: 0 }}>{detailMember.name}</Title>
                      <Space>
                        <Text type="secondary">{detailMember.numberId}</Text>
                        <Text type="secondary">|</Text>
                        <PhoneDisplay phone={detailMember.mobile} />
                      </Space>
                    </div>
                  </Space>
                </Col>
                <Col>
                  <Space>
                    <MemberStageTag stage={detailMember.memberStage} />
                    <IntentionLevelTag level={detailMember.intentionLevel} />
                    <Text type="secondary">{detailMember.owner?.realName || detailMember.owner?.username}</Text>
                  </Space>
                </Col>
              </Row>
            </Card>
            <Tabs activeKey={detailTab} onChange={setDetailTab} items={[
              {
                key: 'basic',
                label: '基本资料',
                children: (
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="姓名">{detailMember.name}</Descriptions.Item>
                    <Descriptions.Item label="手机号"><PhoneDisplay phone={detailMember.mobile} /></Descriptions.Item>
                    <Descriptions.Item label="微信号">{detailMember.wechat || '-'}</Descriptions.Item>
                    <Descriptions.Item label="性别">{detailMember.gender === 1 ? '男' : detailMember.gender === 2 ? '女' : '未知'}</Descriptions.Item>
                    <Descriptions.Item label="年龄">{detailMember.birthday ? `${dayjs().diff(dayjs(detailMember.birthday), 'year')}岁` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="所在地区">{detailMember.provinceId || '-'}</Descriptions.Item>
                    <Descriptions.Item label="来源渠道">{detailMember.source === 'from_customer' ? '从客户转会员' : '直接新增'}</Descriptions.Item>
                    <Descriptions.Item label="创建时间">{dayjs(detailMember.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
                    <Descriptions.Item label="创建人">{detailMember.creatorId}</Descriptions.Item>
                    <Descriptions.Item label="当前负责人">{detailMember.owner?.realName || detailMember.owner?.username || '-'}</Descriptions.Item>
                    <Descriptions.Item label="会员状态">{detailMember.memberStatus === 'active' ? '正常' : '已作废'}</Descriptions.Item>
                    {detailMember.invalidAt && (
                      <Descriptions.Item label="作废时间">{dayjs(detailMember.invalidAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
                    )}
                  </Descriptions>
                ),
              },
              {
                key: 'intention',
                label: '需求意向',
                children: (
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="业务类别">{BUSINESS_CATEGORIES.find(c => c.value === detailMember.businessCategory)?.label || detailMember.businessCategory || '-'}</Descriptions.Item>
                    <Descriptions.Item label="意向项目">{detailMember.intentionProject || '-'}</Descriptions.Item>
                    <Descriptions.Item label="意向等级"><IntentionLevelTag level={detailMember.intentionLevel} /></Descriptions.Item>
                    <Descriptions.Item label="当前阶段"><MemberStageTag stage={detailMember.memberStage} /></Descriptions.Item>
                    <Descriptions.Item label="预算范围">{detailMember.budgetRange || '-'}</Descriptions.Item>
                    <Descriptions.Item label="期望时间">{detailMember.expectedDate ? dayjs(detailMember.expectedDate).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
                    <Descriptions.Item label="偏好医院">{detailMember.preferredHospitalId || '-'}</Descriptions.Item>
                    <Descriptions.Item label="顾客标签">
                      {detailMember.tags?.length > 0
                        ? detailMember.tags.map((t: any) => <Tag key={t.id} color={t.color}>{t.name}</Tag>)
                        : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="备注" span={2}>{detailMember.remark || '-'}</Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'followUp',
                label: '跟进记录',
                children: <FollowUpTab memberId={detailMember.id} />,
              },
              {
                key: 'dispatch',
                label: '派单记录',
                children: <div style={{ padding: 24, textAlign: 'center' }}><Empty description="暂无派单记录" /></div>,
              },
              {
                key: 'log',
                label: '操作日志',
                children: <div style={{ padding: 24, textAlign: 'center' }}><Empty description="暂无操作日志" /></div>,
              },
            ]} />
          </>
        )}
      </Drawer>

      {/* 添加跟进 Modal */}
      <ModalForm
        title="添加跟进记录"
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        onFinish={handleFollowUp}
        width={560}
        layout="vertical"
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormSelect name="followUpMethod" label="跟进方式" options={FOLLOW_UP_METHODS} placeholder="请选择" />
        <ProFormTextArea name="content" label="跟进内容" rules={[{ required: true, max: 5000 }]} placeholder="请输入跟进内容" />
        <ProFormSelect name="result" label="跟进结果" options={FOLLOW_UP_RESULTS} placeholder="请选择" />
        <ProFormSelect name="memberStage" label="当前阶段" options={Object.entries(MEMBER_STAGES).map(([k, v]) => ({ label: v.text, value: k }))} />
        <ProFormSelect name="intentionLevel" label="意向等级" options={Object.entries(INTENTION_LEVELS).map(([k, v]) => ({ label: v.text, value: k }))} />
        <ProFormDateTimePicker name="nextFollowUpAt" label="下次跟进时间" />
      </ModalForm>

      {/* 作废确认 Modal */}
      <Modal
        title="确认作废会员顾客"
        open={invalidateOpen}
        onCancel={() => setInvalidateOpen(false)}
        onOk={handleInvalidate}
        okText="确认作废"
        okButtonProps={{ danger: true }}
      >
        <Paragraph>
          <Text type="danger">
            作废后会员业务暂停，自动跟进任务暂停，不再出现在正常会员列表。
            数据和历史记录保留，可由有权限的用户恢复。
          </Text>
        </Paragraph>
        {selectedRowKeys.length > 0 ? (
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            <Text>以下会员将被作废：</Text>
            {/* We'll show member IDs here */}
            <p>已选择 {selectedRowKeys.length} 条记录</p>
          </div>
        ) : currentMember ? (
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="会员编号">{currentMember.numberId}</Descriptions.Item>
            <Descriptions.Item label="姓名">{currentMember.name}</Descriptions.Item>
            <Descriptions.Item label="业务类别">{currentMember.businessCategory}</Descriptions.Item>
            <Descriptions.Item label="归属客服">{currentMember.owner?.realName || currentMember.owner?.username}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

      {/* 批量分配 Modal */}
      <ModalForm
        title="批量分配客服"
        open={batchAssignOpen}
        onOpenChange={setBatchAssignOpen}
        onFinish={handleBatchAssign}
        width={420}
      >
        <ProFormSelect
          name="toUserId"
          label="目标客服"
          options={users.map((u: any) => ({ label: u.realName || u.username, value: u.id }))}
          rules={[{ required: true }]}
          placeholder="请选择客服"
        />
        <ProFormTextArea name="reason" label="转交原因" placeholder="可选" />
      </ModalForm>

      {/* 批量标签 Modal */}
      <ModalForm
        title="批量打标签"
        open={batchTagOpen}
        onOpenChange={setBatchTagOpen}
        onFinish={handleBatchTag}
        width={420}
      >
        <ProFormSelect
          name="tagIds"
          label="选择标签"
          mode="multiple"
          options={tags.map((t: any) => ({ label: t.name, value: t.id }))}
          rules={[{ required: true }]}
          placeholder="请选择标签"
        />
        <Space>
          <Button size="small" type="link" onClick={() => setCreateTagOpen(true)} icon={<PlusOutlined />}>新建标签</Button>
        </Space>
      </ModalForm>

      {/* 新建标签 Modal */}
      <ModalForm
        title="新建标签"
        open={createTagOpen}
        onOpenChange={setCreateTagOpen}
        onFinish={async (values) => {
          try {
            const res = await createMemberTag(values);
            if (res?.success) {
              message.success('创建成功');
              setCreateTagOpen(false);
              loadTags();
            }
          } catch (e: any) {
            message.error(e?.message || '创建失败');
          }
        }}
        width={360}
      >
        <ProFormText name="name" label="标签名称" rules={[{ required: true }]} placeholder="请输入" />
      </ModalForm>
    </PageContainer>
  );
};

// ── 跟进记录 Tab ──

const FollowUpTab: React.FC<{ memberId: number }> = ({ memberId }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMemberFollowUps(memberId).then((res: any) => {
      if (res?.success) setRecords(res.data || []);
    }).finally(() => setLoading(false));
  }, [memberId]);

  if (loading) return <Spin />;
  if (!records.length) return <Empty description="暂无跟进记录" />;

  return (
    <div style={{ maxHeight: 500, overflow: 'auto' }}>
      {records.map((r) => (
        <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
          <Space style={{ marginBottom: 4 }}>
            <Text strong>{r.operator?.realName || r.operator?.username}</Text>
            <Text type="secondary">{dayjs(r.createdAt).format('YYYY-MM-DD HH:mm')}</Text>
            {r.followUpMethod && <Tag>{FOLLOW_UP_METHODS.find(m => m.value === r.followUpMethod)?.label}</Tag>}
            {r.result && <Tag>{FOLLOW_UP_RESULTS.find(m => m.value === r.result)?.label}</Tag>}
          </Space>
          <div style={{ whiteSpace: 'pre-wrap' }}>{r.content}</div>
          {r.nextFollowUpAt && (
            <div style={{ marginTop: 4 }}>
              <Text type="secondary">下次跟进：{dayjs(r.nextFollowUpAt).format('YYYY-MM-DD HH:mm')}</Text>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MemberPage;
