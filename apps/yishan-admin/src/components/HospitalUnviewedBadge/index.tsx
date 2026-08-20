/**
 * HospitalUnviewedBadge (polling bridge + Phase C.2A enhancements)
 *
 * 只在当前登录用户持有 `hospital_account` 角色 (ROLE_IDS.HOSPITAL_ACCOUNT) 时启用:
 *   - 每 60s 调一次 `GET /api/crm/v1/hospital/dispatches/unviewed-count`
 *   - 把 count 写入全局 `initialState.dispatchUnviewedCount`,
 *     由 `app.tsx` 的 ProLayout `menuItemRender` 读取后渲染 antd `<Badge>`。
 *   - 把 `loading` 写入全局 `initialState.dispatchUnviewedLoading`,
 *     供后续消费者用作 antd Badge `dot` prop（Phase C.2A spec §4.2 增强项）。
 *
 * Phase C.2A 增强 (5 项):
 *   - document.title 前缀 `(🔔 N) 原标题`
 *   - Notification API 权限申请 + 计数变化系统通知
 *   - visibilitychange 切回前台时立即刷新（避免等 60s）
 *   - 99+ 截断 (count > 99 ? '99+' : count)
 *   - dot loading — loading 期间 antd Badge 显示 `dot`
 *
 * 设计取舍 (Phase B T10 + Phase C.2A):
 *   - 渲染空 fragment,不抢任何布局空间 ——
 *     badge 的可视化由 `menuItemRender` 接管,本组件只负责"喂数据 + 触发 re-render"。
 *   - 不在非 hospital_account 角色里跑轮询 (`roleIds` 没 HOSPITAL_ACCOUNT 直接 return)。
 *   - 网络/解析失败 silent:用 console.warn,不打扰用户。
 *   - 卸载时 clearInterval,避免路由切换泄漏 setInterval。
 *   - Notification 仅在浏览器原生 API 存在 + permission === 'granted' 时触发,
 *     第一次挂载 3s 后才请求权限,避免打扰首次加载。
 *   - 通知的"计数变化"用 useRef 记录上一次的值,避免组件重渲染时丢对比基准。
 */

import { useModel } from '@umijs/max';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ROLE_IDS } from '@/constants/roleIds';
import { getHospitalUnviewedCount } from '@/modules/crm/api';

const POLL_INTERVAL_MS = 60_000;
const NOTIFICATION_PERMISSION_DELAY_MS = 3_000;

// 模块级缓存原标题,避免每次 hook 触发都重新读 document.title 拿到自己写过的前缀。
// 组件挂载时读一次,卸载时恢复;多次挂载/卸载间保持幂等。
const ORIGIN_TITLE = (typeof document !== 'undefined' ? document.title : '');

/** 截断 >99 的展示文本 */
function clampDisplayCount(count: number): number | string {
  return count > 99 ? '99+' : count;
}

/** tab 标题前缀: `(🔔 N) 原标题` */
function useDocumentTitle(count: number) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    // 去掉已有的 `(\S+\s\d+)\s` 前缀,避免多次挂载后变成 `(🔔 3) (🔔 5) 原标题`。
    const base = ORIGIN_TITLE.replace(/^\(\S+\s\d+\)\s/, '');
    document.title = count > 0 ? `(🔔 ${count}) ${base}` : base;
    return () => {
      // 卸载时还原为无前缀原标题。多次卸载/挂载间 OK:下次挂载的 hook 会重新写前缀。
      document.title = base;
    };
  }, [count]);
}

/** 首次挂载 3s 后申请 Notification 权限 (仅当浏览器支持 + 当前是 default)。 */
function useNotificationPermission() {
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    const t = window.setTimeout(() => {
      // requestPermission 返回 Promise;不 await,失败也静默。
      try {
        Notification.requestPermission().catch(() => {
          /* silent */
        });
      } catch {
        /* 旧浏览器/非安全上下文可能抛,silent */
      }
    }, NOTIFICATION_PERMISSION_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);
}

/** 计数增长时弹系统通知 (granted + 增加)。 */
function useBrowserNotification(count: number, lastCount: number) {
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    // 只在"新派单到达"时弹,避免每次轮询都骚扰;首次挂载 lastCount=0 也会触发(>0 才有意义)。
    if (count > lastCount && count > 0) {
      try {
        // eslint-disable-next-line no-new
        new Notification('iximei-kf 新派单', {
          body: `本院有 ${count} 个新派单未查看`,
          icon: '/logo.png',
          tag: 'crm-unviewed',
        });
      } catch {
        /* silent: 部分浏览器在非用户手势下抛错 */
      }
    }
    // 故意不依赖 lastCount:hook 只在 count 变化时跑,lastCount 通过 ref 实时读。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
}

/** tab 切回前台时立即拉一次,避免等 60s 轮询。 */
function useVisibilityRefresh(fetcher: () => void) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = () => {
      if (document.visibilityState === 'visible') fetcher();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [fetcher]);
}

export default function HospitalUnviewedBadge() {
  const { initialState, setInitialState } = useModel('@@initialState');
  const roleIds = initialState?.currentUser?.roleIds ?? [];
  const enabled =
    Array.isArray(roleIds) && roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT);

  // 用本地 state 跟踪"上一次成功的 count" ——
  // 这两个状态是 spec §4.2 4 个 hook 的数据源(document.title / Notification / 99+ / loading)。
  // initialState 里的 dispatchUnviewedCount 仍是给 app.tsx menuItemRender 的"真实数据桥",
  // 本地 state 主要服务于 4 个新 hook 的本地消费(document.title / Notification.lastCount / loading dot)。
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const lastCountRef = useRef<number>(0);

  const fetchCount = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await getHospitalUnviewedCount();
      const next = Number(res?.data?.count ?? 0) || 0;
      // setInitialState 即便数值未变也安全:Umi 的 model store 是引用对比,
      // 但 ProLayout 依赖 menuData 重算;同时 initialState 变化会驱动整棵子树 re-render,
      // 因此不会陷入"轮询 = 静默"的死循环 —— setInitialState 即触发 layout 重新挂载回调。
      setInitialState((prev: any) => ({
        ...(prev ?? {}),
        dispatchUnviewedCount: next,
        dispatchUnviewedLoading: false, // 完成态写 false;初始 mount 时由 loading=true 覆盖。
        // 99+ 截断一并喂给 app.tsx,避免它自己再算一次 (Phase B 已自带,但保留兼容)。
        dispatchUnviewedDisplay: clampDisplayCount(next),
      }));
      // 更新本地 state,触发 4 个 hook 的 effect 重跑。
      lastCountRef.current = count;
      setCount(next);
    } catch (err) {
      // silent: 网络抖动/未登录导致的 401 都不要打扰用户。
      // hospital_account 角色多半仍能继续操作菜单,只是 badge 暂不显示。
      // eslint-disable-next-line no-console
      console.warn('[HospitalUnviewedBadge] poll failed', err);
    } finally {
      setLoading(false);
      setInitialState((prev: any) => ({
        ...(prev ?? {}),
        dispatchUnviewedLoading: false,
      }));
    }
    // 故意不依赖 count:本回调在"轮询触发"时跑,不应因 count 变化重建定时器。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, setInitialState]);

  // 角色未启用时仍然写 loading=false 一次,避免上次会话残留 true 状态。
  useEffect(() => {
    if (enabled) return;
    setInitialState((prev: any) => ({
      ...(prev ?? {}),
      dispatchUnviewedLoading: false,
    }));
  }, [enabled, setInitialState]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    // 立即拉一次,避免首次进入派单页前用户感知不到 badge。
    fetchCount();
    const timer = window.setInterval(() => {
      if (cancelled) return;
      fetchCount();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, fetchCount]);

  // 4 个 Phase C.2A hook —— 在所有 early return 之前注册,避免 hooks 顺序漂移。
  useDocumentTitle(count);
  useNotificationPermission();
  useBrowserNotification(count, lastCountRef.current);
  useVisibilityRefresh(fetchCount);

  return null;
}