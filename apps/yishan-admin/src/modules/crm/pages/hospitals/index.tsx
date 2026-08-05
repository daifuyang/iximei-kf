import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Cascader,
  Col,
  Divider,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { FormEditor, type ImageUploadAdapter } from 'yishan-tiptap';
import { AttachmentMultiSelect } from '@/components';
import {
  fetchCloudStorageConfig,
  resolveAttachmentPublicUrl,
  uploadAttachmentFile,
} from '@/utils/attachmentUpload';
import {
  passwordRules,
  passwordConfirmRules,
  passwordStrength,
  PASSWORD_STRENGTH_LABEL,
  PASSWORD_MIN,
  PASSWORD_MAX,
} from '@/utils/password';
import {
  createHospital,
  deleteHospital,
  getHospitalAccount,
  getHospitals,
  getRegionTree,
  renameHospital,
  resetHospitalAccountPassword,
  updateHospital,
  updateHospitalAccount,
} from '../../api';

const natureMap: Record<number, string> = {
  [-1]: '未选择',
  0: '民营',
  1: '公立',
};
const formGutter: [number, number] = [16, 0];
const thirdCol = { xs: 24, md: 8 };
const addressRegionCol = { xs: 24, md: 8 };
const addressDetailCol = { xs: 24, md: 16 };

const hospitalIntroductionImageUploadAdapter: ImageUploadAdapter = {
  upload: async (file) => {
    const res = await uploadAttachmentFile(file, {
      kind: 'image',
      dir: 'attachments',
    });
    if (!res.success) throw new Error(res.message || '图片上传失败');

    const attachment = res.data?.[0];
    const storedUrl = attachment?.path || attachment?.url;
    if (!storedUrl) throw new Error('上传成功但未返回图片地址');

    return resolveAttachmentPublicUrl(
      storedUrl,
      await fetchCloudStorageConfig(),
    );
  },
};

const toRegionOptions = (nodes: any[] = []): any[] =>
  nodes.map((node) => ({
    label: node.name,
    value: node.code,
    children:
      Array.isArray(node.children) && node.children.length > 0
        ? toRegionOptions(node.children)
        : undefined,
  }));

const HospitalPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message: antMessage, modal } = App.useApp();
  // STRICT-SPEC §4.1 / §7.3 / §7.4：基于权限码判断，不依赖 roleCodes 字符串。
  const { initialState } = useModel('@@initialState');
  const perms = initialState?.currentUser?.permissions ?? [];
  // super_admin 用 sentinel '__super_admin__' 短路；其他角色按权限码判定。
  const hasPerm = (code: string) => perms.includes('__super_admin__') || perms.includes(code);
  const canRenameHospital = hasPerm('crm:hospitals:rename');
  const canCreateHospital = hasPerm('crm:hospitals:create');
  const canDeleteHospital = hasPerm('crm:hospitals:delete');
  // 账号管理（启停/重置密码/更新邮箱手机号）需 crm:hospitals:manage-account。
  // 后端 reset-password / account PATCH 路由都用这个权限做 gate。
  // 故意不复用 :update —— 医院账号持有 :update 是为了能改自己医院资料，
  // 但不能顺带拿到"管账号"能力。前端可见性与后端权限严格对齐。
  const canManageHospitalAccount = hasPerm('crm:hospitals:manage-account');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>();
  const [form] = Form.useForm();
  // 唯一账号侧栏：显示只读信息 + 提供「启停 / 重置密码」入口
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [accountHospital, setAccountHospital] = useState<any>();
  const [account, setAccount] = useState<any>();
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountForm] = Form.useForm();
  const [resetPwdModalOpen, setResetPwdModalOpen] = useState(false);
  const [resetPwdForm] = Form.useForm();
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameForm] = Form.useForm();
  const [regionOptions, setRegionOptions] = useState<any[]>([]);
  const [regionLoading, setRegionLoading] = useState(false);

  useEffect(() => {
    setRegionLoading(true);
    getRegionTree({ level: 3 })
      .then((res) => {
        if (res.success) setRegionOptions(toRegionOptions(res.data || []));
      })
      .finally(() => setRegionLoading(false));
  }, []);

  const showForm = (record?: any) => {
    setEditing(record);
    const regionCodes =
      record?.provinceId && record?.cityId && record?.districtId
        ? [record.provinceId, record.cityId, record.districtId]
        : undefined;
    form.setFieldsValue(
      record ? { ...record, regionCodes } : { hospitalNature: -1, status: 1 },
    );
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const { regionCodes, confirmPassword: _cp, ...restValues } = values;
    const payload: any = {
      ...restValues,
      provinceId: regionCodes?.[0],
      cityId: regionCodes?.[1],
      districtId: regionCodes?.[2],
    };
    let res: any;
    if (editing?.id) {
      // STRICT-SPEC §7.1：编辑模式删除创建专用字段（密码/邮箱/手机号/hospitalName）
      //   联系方式通过独立 PATCH /hospitals/:id/account 维护；
      //   密码通过独立 /hospitals/:id/account/reset-password 维护；
      //   改名通过独立 /hospitals/:id/rename 维护。
      delete payload.accountPassword;
      delete payload.accountEmail;
      delete payload.accountPhone;
      delete payload.hospitalName;
      res = await updateHospital(editing.id, payload);
    } else {
      // STRICT-SPEC §7.1：新建模式必须提交 accountPassword。
      //   confirmPassword 仅前端比对，已经从 restValues 移除。
      res = await createHospital(payload);
    }
    if (res.success) antMessage.success(res.message);
    setOpen(false);
    actionRef.current?.reload();
  };

  const openAccountDrawer = async (record: any) => {
    setAccountHospital(record);
    setAccountDrawerOpen(true);
    setAccount(undefined);
    await loadAccount(record.id);
  };

  const loadAccount = async (hospitalId: number) => {
    setAccountLoading(true);
    try {
      const res = await getHospitalAccount(hospitalId);
      if (res.success) {
        setAccount(res.data);
        accountForm.setFieldsValue({
          email: res.data?.email ?? '',
          phone: res.data?.phone ?? '',
          status: res.data?.status ?? 1,
        });
      }
    } finally {
      setAccountLoading(false);
    }
  };

  const submitAccountContact = async () => {
    if (!accountHospital) return;
    const values = await accountForm.validateFields();
    const res = await updateHospitalAccount(accountHospital.id, values);
    if (!res.success) {
      antMessage.error(res.message);
      return;
    }
    antMessage.success(res.message);
    await loadAccount(accountHospital.id);
  };

  const toggleAccountStatus = async () => {
    if (!accountHospital || !account) return;
    const next = account.status === 1 ? 0 : 1;
    const res = await updateHospitalAccount(accountHospital.id, {
      status: next,
    });
    if (!res.success) {
      antMessage.error(res.message);
      return;
    }
    antMessage.success(next === 1 ? '账号已启用' : '账号已停用');
    await loadAccount(accountHospital.id);
  };

  const openResetPwd = () => {
    resetPwdForm.resetFields();
    setResetPwdModalOpen(true);
  };

  const submitResetPwd = async () => {
    if (!accountHospital) return;
    const values = await resetPwdForm.validateFields();
    const res = await resetHospitalAccountPassword(
      accountHospital.id,
      values.newPassword,
    );
    if (!res.success) {
      antMessage.error(res.message);
      return;
    }
    antMessage.success('密码已重置');
    setResetPwdModalOpen(false);
    resetPwdForm.resetFields();
  };

  const openRenameModal = () => {
    renameForm.resetFields();
    setRenameModalOpen(true);
  };

  const submitRename = async () => {
    if (!accountHospital) return;
    const values = await renameForm.validateFields();
    if (values.newHospitalName === accountHospital.hospitalName) {
      antMessage.warning('新名称与当前名称一致');
      return;
    }
    const confirmed = await new Promise<boolean>((resolve) => {
      modal.confirm({
        title: '医院改名将撤销该账号所有会话',
        content:
          '该账号已签发的 JWT/PAT 全部失效，请确认业务侧已通知到位。',
        okText: '确认改名',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) return;
    const res = await renameHospital(
      accountHospital.id,
      values.newHospitalName,
    );
    if (!res.success) {
      antMessage.error(res.message);
      return;
    }
    antMessage.success('医院已改名，旧会话已撤销');
    setRenameModalOpen(false);
    renameForm.resetFields();
    // 同步更新侧栏与列表展示
    setAccountHospital((prev: any) => ({
      ...prev,
      hospitalName: values.newHospitalName,
    }));
    await loadAccount(accountHospital.id);
    actionRef.current?.reload();
  };

  const columns: ProColumns<any>[] = [
    { title: 'ID', dataIndex: 'id', search: false, width: 72 },
    {
      title: '医院名称',
      dataIndex: 'hospitalName',
      copyable: true,
      ellipsis: true,
    },
    {
      title: '账号状态',
      dataIndex: 'hospitalStatus',
      search: false,
      width: 90,
      render: (_, r) => (
        <Tag color={r.status === 1 ? 'green' : 'red'}>
          {r.status === 1 ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '咨询电话',
      dataIndex: 'hospitalPhone',
      search: false,
    },
    {
      title: '营销电话',
      dataIndex: 'hospitalSelling',
      search: false,
    },
    {
      title: '性质',
      dataIndex: 'hospitalNature',
      search: false,
      render: (_, r) => natureMap[r.hospitalNature] || '-',
    },
    {
      title: '微信绑定',
      dataIndex: 'wechatOpenid',
      search: false,
      render: (_, r) =>
        r.wechatOpenid ? <Tag color="green">已绑定</Tag> : <Tag>未绑定</Tag>,
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size={16}>
          {canManageHospitalAccount && (
            <a key="account" onClick={() => openAccountDrawer(record)}>
              账号管理
            </a>
          )}
          <a key="edit" onClick={() => showForm(record)}>
            编辑
          </a>
          {canDeleteHospital && (
            <Popconfirm
              key="delete"
              title="确定删除该医院吗？将同时禁用账号并撤销 Token。"
              onConfirm={async () => {
                const res = await deleteHospital(record.id);
                if (res.success) antMessage.success(res.message);
                actionRef.current?.reload();
              }}
            >
              <a style={{ color: '#ff4d4f' }}>删除</a>
            </Popconfirm>
          )}
        </Space>
      ),
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
          const res = await getHospitals({
            page: params.current,
            pageSize: params.pageSize,
            keyword: params.hospitalName,
            status: params.status,
          });
          return {
            data: res.data || [],
            success: res.success,
            total: res.pagination?.total || 0,
          };
        }}
        columns={columns}
        toolBarRender={() =>
          canCreateHospital
            ? [
                <Button
                  key="new"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => showForm()}
                >
                  新建
                </Button>,
              ]
            : []
        }
      />

      {/* 医院档案：新建 / 编辑 */}
      <Modal
        title={editing ? '编辑医院' : '新建医院'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        width={960}
        destroyOnHidden
        maskClosable={false}
        styles={{
          body: { maxHeight: '72vh', overflowY: 'auto', paddingRight: 8 },
        }}
      >
        <Form form={form} layout="vertical">
          <Divider titlePlacement="left" plain>
            基本信息
          </Divider>
          <Row gutter={formGutter}>
            {!editing && (
              <Col {...thirdCol}>
                <Form.Item
                  name="hospitalName"
                  label="医院名称"
                  rules={[
                    { required: true, message: '请输入医院名称' },
                    { max: 50, message: '医院名称最长 50 字' },
                  ]}
                >
                  <Input placeholder="请输入医院名称" />
                </Form.Item>
              </Col>
            )}
            {editing && (
              <Col {...thirdCol}>
                <Form.Item label="医院名称">
                  <Input value={editing.hospitalName} disabled />
                </Form.Item>
              </Col>
            )}
            <Col {...thirdCol}>
              <Form.Item name="status" label="医院状态">
                <Select
                  placeholder="请选择状态"
                  options={[
                    { label: '启用', value: 1 },
                    { label: '停用', value: 0 },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="hospitalNature" label="经营性质">
                <Select
                  placeholder="请选择经营性质"
                  options={[
                    { label: '未选择', value: -1 },
                    { label: '民营', value: 0 },
                    { label: '公立', value: 1 },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* 仅新建时需要账号字段 */}
          {!editing && (
            <>
              <Divider titlePlacement="left" plain>
                账号信息
              </Divider>
              <Row gutter={formGutter}>
                <Col {...thirdCol}>
                  <Form.Item
                    name="accountPassword"
                    label="初始密码"
                    // 规则与后端 core/utils/password-policy.ts 严格对齐
                    // (PASSWORD_MIN/PASSWORD_MAX + 复杂度 pattern)。
                    // 大厂风格：长度错误时只提示长度，复杂度错误时再提示复杂度，
                    // 用户能立刻看出"为什么被拒"，不再含糊。
                    rules={passwordRules({ required: true })}
                    extra={
                      <PasswordRuleHint
                        name="accountPassword"
                        form={form}
                      />
                    }
                  >
                    <Input.Password
                      placeholder="请输入初始密码"
                      autoComplete="new-password"
                    />
                  </Form.Item>
                </Col>
                <Col {...thirdCol}>
                  <Form.Item
                    name="confirmPassword"
                    label="确认密码"
                    dependencies={['accountPassword']}
                    rules={passwordConfirmRules('accountPassword')}
                  >
                    <Input.Password
                      placeholder="请再次输入初始密码"
                      autoComplete="new-password"
                    />
                  </Form.Item>
                </Col>
                <Col {...thirdCol}>
                  <Form.Item name="accountEmail" label="账号邮箱">
                    <Input placeholder="可选, 用于找回密码" />
                  </Form.Item>
                </Col>
                <Col {...thirdCol}>
                  <Form.Item name="accountPhone" label="账号手机号">
                    <Input placeholder="可选" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <Divider titlePlacement="left" plain>
            地址信息
          </Divider>
          <Row gutter={formGutter}>
            <Col {...addressRegionCol}>
              <Form.Item name="regionCodes" label="省市区">
                <Cascader
                  allowClear
                  changeOnSelect
                  loading={regionLoading}
                  options={regionOptions}
                  placeholder="请选择省市区"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col {...addressDetailCol}>
              <Form.Item name="hospitalAddress" label="详细地址">
                <Input placeholder="请输入详细地址" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain>
            联系方式
          </Divider>
          <Row gutter={formGutter}>
            <Col {...thirdCol}>
              <Form.Item name="hospitalPhone" label="咨询电话">
                <Input placeholder="请输入咨询电话" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="hospitalSelling" label="营销电话">
                <Input placeholder="请输入营销电话" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="hospitalWebsite" label="官网">
                <Input placeholder="https://" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={formGutter}>
            <Col {...thirdCol}>
              <Form.Item name="doctorName" label="就医联系人">
                <Input placeholder="联系人姓名" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="doctorPhone" label="就医电话">
                <Input placeholder="就医联系电话" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="doctorQq" label="就医QQ">
                <Input placeholder="QQ号" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="receptionName" label="前台联系人">
                <Input placeholder="联系人姓名" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="receptionPhone" label="前台电话">
                <Input placeholder="前台联系电话" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="receptionQq" label="前台QQ">
                <Input placeholder="QQ号" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain>
            交通信息
          </Divider>
          <Row gutter={formGutter}>
            <Col {...thirdCol}>
              <Form.Item name="busStation" label="公交站">
                <Input placeholder="公交站点" />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="busAddress" label="公交路线">
                <Input placeholder="公交路线说明" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="subwayStation" label="地铁站">
                <Input placeholder="地铁站点" />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="subwayAddress" label="地铁路线">
                <Input placeholder="地铁路线说明" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain>
            商务政策
          </Divider>
          <Row gutter={formGutter}>
            <Col {...thirdCol}>
              <Form.Item name="taxiFare" label="出租车费">
                <Input placeholder="例如: 约35元" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="vipDiscount" label="会员优惠">
                <Input placeholder="请输入会员优惠" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="returnPoint" label="医院返点">
                <Input placeholder="例如: 10%" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain>
            补充资料
          </Divider>
          <Form.Item name="hospitalIntroduction" label="医院简介">
            <FormEditor
              maxHeight={360}
              imageUploadAdapter={hospitalIntroductionImageUploadAdapter}
            />
          </Form.Item>
          <Form.Item name="contractPhotos" label="合同图片">
            <AttachmentMultiSelect kind="image" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 唯一账号侧栏：只读视图 + 启停 + 重置密码 */}
      <Drawer
        title={`账号管理 — ${accountHospital?.hospitalName ?? ''}`}
        open={accountDrawerOpen}
        onClose={() => setAccountDrawerOpen(false)}
        width={640}
        loading={accountLoading}
        footer={
          <Space>
            <Button onClick={() => setAccountDrawerOpen(false)}>关闭</Button>
            <Button type="primary" onClick={submitAccountContact}>
              保存联系方式
            </Button>
          </Space>
        }
      >
        {account && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="账号状态"
                  value={account.status === 1 ? '启用' : '停用'}
                  valueStyle={{
                    color: account.status === 1 ? '#52c41a' : '#ff4d4f',
                    fontSize: 18,
                  }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="最近登录"
                  value={
                    account.lastLoginTime
                      ? dayjs(account.lastLoginTime).format(
                          'YYYY-MM-DD HH:mm:ss',
                        )
                      : '从未登录'
                  }
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
            </Row>
            <Divider />
            <Form form={accountForm} layout="vertical">
              <Form.Item label="登录用户名">
                <Input value={account.username} disabled />
              </Form.Item>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[{ type: 'email', message: '邮箱格式不正确' }]}
              >
                <Input placeholder="账号邮箱" />
              </Form.Item>
              <Form.Item name="phone" label="手机号">
                <Input placeholder="账号手机号" />
              </Form.Item>
              <Form.Item name="status" label="账号启停">
                <Select
                  options={[
                    { label: '启用', value: 1 },
                    { label: '停用', value: 0 },
                  ]}
                />
              </Form.Item>
            </Form>
            <Divider />
            <Space wrap>
              <Button onClick={openResetPwd}>重置密码</Button>
              {canRenameHospital && (
                <Button onClick={openRenameModal}>改名</Button>
              )}
              <Popconfirm
                title={
                  account.status === 1 ? '确定停用该账号？' : '确定启用该账号？'
                }
                onConfirm={toggleAccountStatus}
              >
                <Button danger={account.status === 1}>
                  {account.status === 1 ? '停用账号' : '启用账号'}
                </Button>
              </Popconfirm>
            </Space>
          </>
        )}
      </Drawer>

      {/* 仅超管可触发的医院改名：同步更新用户名、撤销会话/Token、记审计日志 */}
      <Modal
        title={`医院改名 — ${accountHospital?.hospitalName ?? ''}`}
        open={renameModalOpen}
        onOk={submitRename}
        onCancel={() => setRenameModalOpen(false)}
        destroyOnHidden
        okText="确认改名"
        cancelText="取消"
      >
        <Alert
          showIcon
          type="warning"
          message="改名后将撤销该账号所有活跃会话与 Token。"
          style={{ marginBottom: 16 }}
        />
        <Form form={renameForm} layout="vertical">
          <Form.Item
            name="newHospitalName"
            label="新医院名称"
            rules={[
              { required: true, message: '请输入新医院名称' },
              { max: 50, message: '医院名称最长 50 字' },
            ]}
          >
            <Input placeholder="请输入新医院名称" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重置账号密码"
        open={resetPwdModalOpen}
        onOk={submitResetPwd}
        onCancel={() => setResetPwdModalOpen(false)}
        destroyOnHidden
      >
        <Form form={resetPwdForm} layout="vertical">
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={passwordRules({ required: true })}
            extra={
              <PasswordRuleHint
                name="newPassword"
                form={resetPwdForm}
              />
            }
          >
            <Input.Password placeholder="新密码" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmNewPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={passwordConfirmRules('newPassword')}
          >
            <Input.Password
              placeholder="再次输入新密码"
              autoComplete="new-password"
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

// ── 密码规则提示 ──
// 大厂风格：实时显示 4 条规则（长度、字母、数字、字符集）+ 强度条，
// 已通过的规则标绿，未通过的标红。空值时不显示（避免视觉噪音）。
// 用 Form.useWatch 订阅字段值，input 变化时实时重渲。
const PasswordRuleHint: React.FC<{ name: string; form: any }> = ({ name, form }) => {
  const value: string | undefined = Form.useWatch(name, form);
  if (!value) return null;
  const len = value.length;
  const hasLetter = /[a-zA-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const validChars = /^[a-zA-Z\d@$!%*?&]+$/.test(value);
  const lengthOk = len >= PASSWORD_MIN && len <= PASSWORD_MAX;
  const rules = [
    { ok: lengthOk, text: `长度 ${PASSWORD_MIN}-${PASSWORD_MAX} 位（当前 ${len}）` },
    { ok: hasLetter, text: '包含字母' },
    { ok: hasDigit, text: '包含数字' },
    { ok: validChars, text: '仅含字母、数字和 @$!%*?&' },
  ];
  const strength = passwordStrength(value);
  const sLabel = PASSWORD_STRENGTH_LABEL[strength];
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
        {rules.map((r) => (
          <span
            key={r.text}
            style={{
              color: r.ok ? '#52c41a' : '#ff4d4f',
              transition: 'color 0.2s',
            }}
          >
            {r.ok ? '✓' : '○'} {r.text}
          </span>
        ))}
      </div>
      <div
        style={{
          marginTop: 4,
          height: 4,
          background: '#f0f0f0',
          borderRadius: 2,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${(strength / 3) * 100}%`,
            height: '100%',
            background: sLabel.color,
            transition: 'width 0.2s',
          }}
        />
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 12,
          color: sLabel.color,
        }}
      >
        强度：{sLabel.text}
      </div>
    </div>
  );
};

export default HospitalPage;
