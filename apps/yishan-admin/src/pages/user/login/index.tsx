import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useIntl, FormattedMessage } from "@umijs/max";
import { Alert, App, Button, Checkbox, Form, Input } from "antd";
import { createStyles } from "antd-style";
import React, { useState } from "react";
import { login as userLogin } from "@/services/generated/auth";
import { saveTokens } from "@/utils/token";
import loginBgImage from "@public/images/login-bg.png";
import loginBrandImage from "@public/images/login-brand.png";

const useStyles = createStyles(({ css }) => {
  return {
    root: {
      display: "flex",
      backgroundImage: `url('${loginBgImage}')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      width: "100%",
      height: "100vh",
      "@media (max-width: 992px)": {
        padding: "20px",
      },
      "@media (max-width: 768px)": {
        padding: "16px",
        alignItems: "center",
        justifyContent: "center",
      },
    },
    brand: {
      backgroundImage: `url('${loginBrandImage}')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      width: "56.67%",
      height: "100%",
      "@media (max-width: 1200px)": {
        width: "50%",
      },
      "@media (max-width: 992px)": {
        display: "none",
      },
    },
    loginWrap: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    loginCard: {
      width: "min(481px, 100%)",
      backgroundColor: "#fff",
      padding: "56px 48px 88px 48px",
      borderRadius: "20px",
      boxShadow:
        " 0px 0px 0px  rgba(0, 0, 0, 0.1), 0px 17px 36px  rgba(23, 57, 222, 0.25)",
      "@media (max-height: 720px)": {
        padding: "40px 40px 56px",
      },
      "@media (max-width: 768px)": {
        padding: "28px 20px 32px",
        borderRadius: "16px",
      },
    },
    loginTitle: {
      fontFamily: "Noto Sans SC",
      textAlign: "center",
      fontSize: "clamp(28px, 4.5vw, 36px)",
      fontWeight: 700,
      color: "#000",
      margin: 0,
    },
    loginSubTitle: {
      fontFamily: "Noto Sans SC",
      textAlign: "center",
      marginTop: "12px",
      fontSize: "clamp(14px, 3.5vw, 16px)",
      fontWeight: 400,
      color: "#000",
      margin: 0,
    },
    loginForm: {
      marginTop: "40px",
      "@media (max-height: 720px)": {
        marginTop: "28px",
      },
      "@media (max-width: 768px)": {
        marginTop: "28px",
      },
    },
    loginFormItem: css`
      background-color: rgba(231, 241, 253, 0.4);
      &.ant-input-affix-wrapper > input.ant-input {
        &::placeholder {
          font-size: 18px;
          color: rgba(4, 19, 74, 0.4);
          font-family: 'Noto Sans SC';
          font-weight: 400;
        }
        padding: 6px 8px;
        font-size: 18px;
        color: rgba(4, 19, 74, 0.4);
        font-family: 'Noto Sans SC';
        font-weight: 400;
      }
    `,
    loginField: css`
      margin-bottom: 20px;

      .ant-form-item-explain-error {
        margin-top: 6px;
        font-size: 13px;
        line-height: 20px;
      }
    `,
    loginItemIcon: {
      fontSize: "24px",
      color: "rgba(28, 53, 145, 0.6)",
      "@media (max-width: 768px)": {
        fontSize: "20px",
      },
    },
    loginFormCheckBox: css`
      & .ant-checkbox + span {
        color: rgba(4, 19, 74, 0.4);
        font-size: 18px;
        font-weight: 400;
      }
      @media (max-width: 768px) {
        & .ant-checkbox + span {
          font-size: 15px;
        }
      }
    `,
    rememberItem: css`
      margin-bottom: 24px;
      @media (max-height: 720px) {
        margin-bottom: 16px;
      }
      @media (max-width: 768px) {
        margin-bottom: 16px;
      }
    `,
    submitItem: css`
      margin-bottom: 0;
    `,
    loginFormBtn: css`
      &.ant-btn {
        height: 56px;
        padding: 0 16px;
        font-size: 18px;
        font-weight: 600;
        border-radius: 8px;
      }
      @media (max-width: 768px) {
        &.ant-btn {
          height: 48px;
          font-size: 16px;
        }
      }
    `,
  };
});

const LoginMessage: React.FC<{
  content: string;
}> = ({ content }) => {
  return (
    <Alert
      style={{
        marginBottom: 24,
      }}
      message={content}
      type="error"
      showIcon
    />
  );
};

const Login: React.FC = () => {
  const [loginError, setLoginError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const { styles } = useStyles();
  const { message } = App.useApp();
  const intl = useIntl();

  const resolveRedirectAfterLogin = () => {
    const redirect = new URL(window.location.href).searchParams.get("redirect");
    if (!redirect) return '/';
    try {
      const target = new URL(redirect, window.location.origin);
      let normalizedPath = target.pathname;
      const basePrefix = __APP_BASE__ === '/' ? '' : __APP_BASE__.replace(/\/+$/, '');
      if (basePrefix && normalizedPath.startsWith(basePrefix)) {
        normalizedPath = normalizedPath.slice(basePrefix.length) || '/';
      }
      if (normalizedPath === "/user/login" || normalizedPath === "/") {
        return '/';
      }
      return `${normalizedPath}${target.search}${target.hash}`;
    } catch {
      return '/';
    }
  };

  const hardRedirectAfterLogin = (targetPath: string) => {
    const basePrefix = __APP_BASE__ === '/' ? '' : __APP_BASE__.replace(/\/+$/, '');
    window.location.href = `${basePrefix}${targetPath}`;
  };

  const handleSubmit = async (values: API.loginReq) => {
    setLoading(true);
    setLoginError("");

    try {
      // 登录 — skipErrorHandler 抑制全局 BizError toast，本页自管提示文案。
      // 后端错误码 22007(用户名或密码错误) / 用户被禁用 / 锁定等都会以 success:false 形态
      // 返回到 msg，这里用 msg.message 兜底；只在网络层抛异常时才走 catch。
      const msg = await userLogin({ ...values }, { skipErrorHandler: true });

      // 完全依赖API返回的success字段判断成功或失败
      if (msg.success) {
        const defaultLoginSuccessMessage = intl.formatMessage({
          id: "pages.login.success",
          defaultMessage: "登录成功！",
        });
        message.success(msg.message || defaultLoginSuccessMessage);

        // 处理不同的响应格式
        if (msg.data) {
          // 统一使用 OpenAPI 返回的字段名：token、expiresIn、refreshToken、refreshTokenExpiresIn
          saveTokens({
            accessToken: msg.data.token,
            refreshToken: msg.data.refreshToken || "",
            accessTokenExpiresIn: msg.data.expiresIn,
            refreshTokenExpiresIn: msg.data.refreshTokenExpiresIn,
          });
        }

        // 整页跳转后由 getInitialState 统一获取当前用户，避免重复请求 /auth/me。
        hardRedirectAfterLogin(resolveRedirectAfterLogin());
        return;
      }

      // 登录失败，直接使用API返回的错误信息（后端业务异常已映射到 msg.message）
      const errorMessage = msg.message || "登录失败，请重试";
      message.error(errorMessage);
      setLoginError(errorMessage);
    } catch (error: any) {
      // 网络/底层异常：requestErrorConfig 会通过 BizError 把后端 message 注入到 error.info。
      // 这里兜底链：后端真实文案 -> error.message -> 国际化兜底。
      const apiMessage =
        error?.info?.errorMessage ||
        error?.response?.data?.message ||
        (typeof error?.message === "string" && error.message
          ? error.message
          : null);
      const defaultLoginFailureMessage = intl.formatMessage({
        id: "pages.login.failure",
        defaultMessage: "登录失败，请重试",
      });
      const errorMessage = apiMessage || defaultLoginFailureMessage;
      message.error(errorMessage);
      setLoginError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "上午好";
    if (hour < 18) return "下午好";
    return "晚上好";
  };

  const greeting = getGreeting();

  return (
    <div className={styles.root}>
      <div className={styles.brand}></div>
      <div className={styles.loginWrap}>
        <div className={styles.loginCard}>
          <h1 className={styles.loginTitle}>欢迎登录系统</h1>
          <p className={styles.loginSubTitle}> {greeting}!</p>
          <Form
            onFinish={async (values: any) => {
              const { username, password, remember } = values || {};
              await handleSubmit({ username, password, rememberMe: !!remember });
            }}
            className={styles.loginForm}
            name="basic"
          >
            {loginError && <LoginMessage content={loginError} />}
            <Form.Item
              name="username"
              className={styles.loginField}
              validateFirst
              rules={[
                {
                  required: true,
                  message: intl.formatMessage({
                    id: "pages.login.username.required",
                    defaultMessage: "请输入用户名",
                  }),
                },
                {
                  validator: (_, value) => {
                    // 空值由 required 规则负责，避免与长度校验同时显示两条错误提示。
                    if (!value) return Promise.resolve();
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (value.length < 3 && !emailRegex.test(value)) {
                      return Promise.reject(new Error("用户名至少需要3个字符"));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input
                className={styles.loginFormItem}
                variant="filled"
                placeholder={intl.formatMessage({
                  id: "pages.login.username.placeholder",
                  defaultMessage: "用户名",
                })}
                prefix={<UserOutlined className={styles.loginItemIcon} />}
              />
            </Form.Item>
            <Form.Item
              name="password"
              className={styles.loginField}
              validateFirst
              rules={[
                {
                  required: true,
                  message: intl.formatMessage({
                    id: "pages.login.password.required",
                    defaultMessage: "请输入密码！",
                  }),
                },
              ]}
            >
              <Input.Password
                className={styles.loginFormItem}
                variant="filled"
                placeholder={intl.formatMessage({
                  id: "pages.login.password.placeholder",
                  defaultMessage: "密码",
                })}
                prefix={<LockOutlined className={styles.loginItemIcon} />}
              />
            </Form.Item>
            <Form.Item name="remember" valuePropName="checked" className={styles.rememberItem}>
              <Checkbox className={styles.loginFormCheckBox}>
                <FormattedMessage id="pages.login.rememberMe" defaultMessage="自动登录" />
              </Checkbox>
            </Form.Item>
            <Form.Item className={styles.submitItem}>
              <Button className={styles.loginFormBtn} type="primary" htmlType="submit" block loading={loading}>
                立即登录
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Login;
