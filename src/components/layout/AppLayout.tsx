/**
 * AppLayout 应用主布局
 *
 * 桌面端：左侧 Sidebar + 右侧（Topbar + 滚动主区）。
 * 移动端：顶部 Topbar + 主内容区 + 底部 MobileTabBar。
 *
 * 主区使用 AnimatePresence + Framer Motion 实现路由切换过渡（淡入 + Y 轴位移）。
 * 全局搜索面板在此挂载，覆盖所有路由。
 */
import { Suspense } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileTabBar from './MobileTabBar';
import GlobalSearch from '../GlobalSearch';
import { ToastContainer } from '../feedback/Toast';
import { Skeleton } from '../ui/Skeleton';
import { useKeyboardShortcuts } from '../../hooks';
import { useToastStore, useBookStore } from '../../stores';

/** 路由懒加载时的占位组件 */
function PageLoading() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <Skeleton width="100%" height="100%" className="max-h-24" />
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
