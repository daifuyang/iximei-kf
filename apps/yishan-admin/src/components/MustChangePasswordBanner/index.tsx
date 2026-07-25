/**
 * MustChangePasswordBanner
 *
 * 全局头部 banner,后端在 `password_change_recommended = 1` 时出现。
 *
 * 设计点:
 *   - 不强制跳转 — 用户可以 [稍后] 关掉,本地态不持久化,刷新页面 banner 仍会再出现
 *     (因为 recom 字段还在 DB / currentUser 缓存里)
 *   - 显式 [立即修改] 按钮跳 /user/change-password
 *   - 通过登出场景由后端 changePassword 自动清 0,前端不需要单独清 recom
 *   - 因为只在 /api/v1/auth/me 拿到 `passwordChangeRecommended` 后才渲染,
 *     即使服务端后挂 init 状态也不会闪 banner
 */

import { Alert, Button, Space } from 'antd';
import { useState } from 'react';
import { useIntl } from '@umijs/max';
import { history } from '@umijs/max';

interface Props {
  visible: boolean;
}

export default function MustChangePasswordBanner({ visible }: Props) {
  const intl = useIntl();
  const [dismissed, setDismissed] = useState(false);

  if (!visible || dismissed) return null;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1001,
        padding: '8px 24px',
        background: '#fffbe6',
        borderBottom: '1px solid #ffe58f',
      }}
    >
      <Alert
        banner
        type="warning"
        showIcon
        message={intl.formatMessage({
          id: 'pages.mustChangePasswordBanner.title',
          defaultMessage:
            '检测到您的账号来自旧系统,建议立即修改密码以保障账号安全',
        })}
        description={
          <Space>
            <Button
              type="primary"
              size="small"
              onClick={() => history.push('/user/change-password')}
            >
              {intl.formatMessage({
                id: 'pages.mustChangePasswordBanner.cta',
                defaultMessage: '立即修改',
              })}
            </Button>
            <Button
              size="small"
              type="text"
              onClick={() => setDismissed(true)}
            >
              {intl.formatMessage({
                id: 'pages.mustChangePasswordBanner.dismiss',
                defaultMessage: '稍后',
              })}
            </Button>
          </Space>
        }
      />
    </div>
  );
}
