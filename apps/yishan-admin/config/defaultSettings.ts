import type { ProLayoutProps } from '@ant-design/pro-components';
import { normalizePublicPath } from '../shared/publicPath';

// 配置文件在构建阶段由 Node 执行，运行时则由 Umi 注入 __APP_BASE__。
// 两个入口均从同一个 PUBLIC_PATH 推导，避免 public 资源在 /admin/ 部署时回退到站点根目录。
const publicPath =
  typeof __APP_BASE__ === 'string'
    ? __APP_BASE__
    : process.env.PUBLIC_PATH || '/';

/**
 * @name
 */
const Settings: ProLayoutProps & {
  pwa?: boolean;
  logo?: string;
} = {
  navTheme: 'light',
  // 拂晓蓝
  colorPrimary: '#1677FF',
  layout: 'mix',
  contentWidth: 'Fluid',
  fixedHeader: false,
  fixSiderbar: true,
  colorWeak: false,
  title: '熙爱美客户管理系统',
  pwa: true,
  logo: `${normalizePublicPath(publicPath)}logo.svg`,
  iconfontUrl: '',
  token: {
    colorPrimary: '#1677FF',
    header: {
      colorBgHeader: '#FFFFFF',
    },
    sider: {
      colorMenuBackground: '#FFFFFF',
      colorBgMenuItemSelected: '#E6F4FF',
      colorTextMenuSelected: '#1677FF',
    },
    pageContainer: {
      paddingInlinePageContainerContent: 24,
    },
  },
};

export default Settings;
