/**
 * HospitalUnviewedBadge (polling bridge)
 *
 * 只在当前登录用户持有 `hospital_account` 角色 (id=3) 时启用:
 *   - 每 60s 调一次 `GET /api/crm/v1/hospital/dispatches/unviewed-count`
 *   - 把 count 写入全局 `initialState.dispatchUnviewedCount`,
 *     由 `app.tsx` 的 ProLayout `menuItemRender` 读取后渲染 antd `<Badge>`。
 *
 * 设计取舍 (Task 10 Phase B):
 *   - 渲染空 fragment,不抢任何布局空间 ——
 *     badge 的可视化由 `menuItemRender` 接管,本组件只负责"喂数据 + 触发 re-render"。
 *   - 不在非 hospital_account 角色里跑轮询 (`roleIds` 没 3 直接 return)。
 *   - 网络/解析失败 silent:用 console.warn,不打扰用户。
 *   - 卸载时 clearInterval,避免路由切换泄漏 setInterval。
 */

import { useModel } from '@umijs/max';
import { useEffect } from 'react';
import { getHospitalUnviewedCount } from '@/modules/crm/api';

const HOSPITAL_ACCOUNT_ROLE_ID = 3;
const POLL_INTERVAL_MS = 60_000;

export default function HospitalUnviewedBadge() {
  const { initialState, setInitialState } = useModel('@@initialState');
  const roleIds = initialState?.currentUser?.roleIds ?? [];
  const enabled =
    Array.isArray(roleIds) && roleIds.includes(HOSPITAL_ACCOUNT_ROLE_ID);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await getHospitalUnviewedCount();
        if (cancelled) return;
        const next = Number(res?.data?.count ?? 0) || 0;
        // setInitialState 即便数值未变也安全:Umi 的 model store 是引用对比,
        // 但 ProLayout 依赖 menuData 重算;同时 initialState 变化会驱动整棵子树 re-render,
        // 因此不会陷入"轮询 = 静默"的死循环 —— setInitialState 即触发 layout 重新挂载回调。
        setInitialState((prev: any) => ({
          ...(prev ?? {}),
          dispatchUnviewedCount: next,
        }));
      } catch (err) {
        // silent: 网络抖动/未登录导致的 401 都不要打扰用户。
        // hospital_account 角色多半仍能继续操作菜单,只是 badge 暂不显示。
        // eslint-disable-next-line no-console
        console.warn('[HospitalUnviewedBadge] poll failed', err);
      }
    };

    // 立即拉一次,避免首次进入派单页前用户感知不到 badge。
    fetchCount();
    const timer = window.setInterval(fetchCount, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, setInitialState]);

  return null;
}
