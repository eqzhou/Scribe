/**
 * AppLayout 应用主布局
 *
 * 桌面端：左侧 Sidebar + 右侧（Topbar + 滚动主区）。
 * 移动端：顶部 Topbar + 主内容区 + 底部 MobileTabBar。
 *
 * 主区使用 AnimatePresence + Framer Motion 实现路由切换过渡（淡入 + Y 轴位移）。
 * 全局搜索面板在此挂载，覆盖所有路由。
 */
import { Suspense, useEffect, useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileTabBar from './MobileTabBar';
import GlobalSearch from '../GlobalSearch';
import { ToastContainer } from '../feedback/Toast';
import { useKeyboardShortcuts } from '../../hooks';
import { useToastStore, useBookStore } from '../../stores';

const ROUTE_LOADING_DELAY_MS = 220;

/** 路由懒加载时的占位组件 */
function PageLoading() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), ROUTE_LOADING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="flex h-full items-center justify-center p-8" aria-live="polite">
      <div
        role="status"
        aria-label="页面加载中"
        className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none"
      />
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const element = useOutlet();
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);
  // 当前作品 ID：纳入 motion.div key，切换作品时强制 remount 页面，
  // 彻底清除旧项目的 useApiQuery 缓存数据与页面内部状态
  const currentBookId = useBookStore((s) => s.currentBookId);
  // 在 Router 上下文内注册全局快捷键（Alt+1~8 / Ctrl+K / Ctrl+N）
  useKeyboardShortcuts();
  return (
    <div className="relative z-10 flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${location.pathname}::${currentBookId ?? ''}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="h-full"
            >
              <Suspense fallback={<PageLoading />}>{element}</Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {/* 移动端底部 Tab 导航 */}
      <MobileTabBar />
      {/* 全局搜索命令面板：Ctrl+K 唤起，覆盖所有路由 */}
      <GlobalSearch />
      {/* 全局 Toast 通知：覆盖所有路由 */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
