/**
 * /user/change-password
 *
 * 给"banner 推荐改密"的用户一个集中的修改密码页面。
 * 不同于"个人中心 → 安全设置"中的改密流程,这个页面:
 *   - 仍是 `PUT /api/v1/app/users/me/password`(带旧密码校验)
 *   - 后端 changePassword 在事务内会清零 `password_change_recommended`
 *     + 撤销所有 token,前端改完后会被 logout(true) 然后跳登录
 *
 * 之所以仍是带旧密码:用户在 banner 场景下本就是用旧密码登录的,
 * 提交后该旧密码被新密码覆盖,逻辑对称。
 */

import { LockOutlined } from '@ant-design/icons';
import { App, Button, Card, Form, Input } from 'antd';
import { useState } from 'react';
import { useIntl } from '@umijs/max';
import { logout } from '@/utils/auth';
import { appChangeMyPassword } from '@/services/generated/appUsers';

const PASSWORD_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/;

export default function ChangePasswordPage() {
  const { message } = App.useApp();
  const intl = useIntl();
  const [form] = Form.useForm<{
    oldPassword: string;
    newPassword: string;
    confirm: string;
  }>();
  const [submitting, setSubmitting] = useState(false);

  const t = (id: string, defaultMessage?: string) =>
    intl.formatMessage({ id, defaultMessage });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Card style={{ width: 480, borderRadius: 12 }}>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>
          {t('pages.changePassword.title', '修改密码')}
        </h2>
        <p style={{ color: '#666', marginBottom: 24 }}>
          {t(
            'pages.changePassword.subtitle',
            '为了您的账号安全,请设置一个全新的密码。修改成功后将自动登出,请用新密码重新登录。',
          )}
        </p>
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            setSubmitting(true);
            try {
              const res: any = await appChangeMyPassword({
                oldPassword: values.oldPassword,
                newPassword: values.newPassword,
              });
              if (res?.success) {
                message.success(
                  t(
                    'pages.changePassword.success',
                    '密码已修改,请使用新密码重新登录',
                  ),
                );
                form.resetFields();
                // 后端在事务内撤销该用户所有 token;前端清掉本地会话然后跳登录。
                // 后端把 password_change_recommended 也置 0,重登后 banner 不再出现。
                await logout(true);
                return;
              }
              message.error(
                res?.message ??
                  t('pages.changePassword.error', '密码修改失败'),
              );
            } catch (e: any) {
              message.error(
                e?.message ??
                  t('pages.changePassword.error', '密码修改失败'),
              );
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Form.Item
            name="oldPassword"
            label={t('pages.changePassword.oldPassword', '当前密码')}
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="current-password"
            />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label={t('pages.changePassword.newPassword', '新密码')}
            rules={[
              { required: true, message: '请输入新密码' },
              {
                pattern: PASSWORD_PATTERN,
                message: '密码至少 6 位,且必须包含字母和数字',
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item
            name="confirm"
            label={t('pages.changePassword.confirm', '确认新密码')}
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              block
            >
              {t('pages.changePassword.submit', '修改密码')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
