/**
 * App 应用根组件
 *
 * 配置路由表（依据技术架构第 3 章）：
 * - /login → 认证页（登录/注册，无需 auth）
 * - / → 重定向至 /dashboard（已登录）或 /login（未登录）
 * - /dashboard /projects /worldview /characters /plot /scenes /editor /inspiration
 * - 各模块支持子路由参数（如 /characters/:id、/worldview/:categoryId/:entryId 等）
 *
 * 路由采用 createBrowserRouter + RouterProvider。
 * 页面组件静态导入，避免工作台内模块切换时出现异步加载占位闪烁。
 * 全局快捷键 useKeyboardShortcuts 在 AppLayout（Router 上下文内）注册，
 * 因其内部使用 useNavigate，必须在 RouterProvider 提供的上下文中调用。
 *
 * 认证：应用启动时调用 useUserStore.hydrate() 从 localStorage 恢复登录态；
 * 除 /login 外的所有路由由 RequireAuth 包裹，未登录将重定向至 /login。
 */
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import { RequireAuth } from './components/RequireAuth';
import { getAppBasePath } from './lib/appBase';
import { useUserStore } from './stores/userStore';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import WorldviewPage from './pages/WorldviewPage';
import CharactersPage from './pages/CharactersPage';
import PlotPage from './pages/PlotPage';
import ScenesPage from './pages/ScenesPage';
import SceneDetailPage from './pages/SceneDetailPage';
import EditorPage from './pages/EditorPage';
import InspirationPage from './pages/InspirationPage';
import SettingsPage from './pages/SettingsPage';

// 应用启动时从 localStorage 恢复认证态（同步操作，先于路由渲染执行）
useUserStore.getState().hydrate();

/** 根路径重定向：已登录 → /dashboard，未登录 → /login */
function RootRedirect() {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

const router = createBrowserRouter([
  // 认证页：不进入 AppLayout，不需要登录
  {
    path: '/login',
    element: <AuthPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <RootRedirect /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      // 世界观：列表 + 分类/条目详情（同页面，参数由页面内部处理）
      { path: 'worldview', element: <WorldviewPage /> },
      { path: 'worldview/:categoryId/:entryId', element: <WorldviewPage /> },
      // 角色：列表 + 关系图谱 + 单个详情（静态路由优先于动态参数）
      { path: 'characters', element: <CharactersPage /> },
      { path: 'characters/relations', element: <CharactersPage /> },
      { path: 'characters/:id', element: <CharactersPage /> },
      // 剧情：列表 + 时间线 + 伏笔追踪（同页面，Tab 切换）
      { path: 'plot', element: <PlotPage /> },
      { path: 'plot/timeline', element: <PlotPage /> },
      { path: 'plot/foreshadowing', element: <PlotPage /> },
      // 场景：列表 + 单个详情
      { path: 'scenes', element: <ScenesPage /> },
      { path: 'scenes/:id', element: <SceneDetailPage /> },
      // 写作编辑器
      { path: 'editor', element: <EditorPage /> },
      // 灵感库
      { path: 'inspiration', element: <InspirationPage /> },
      // 设置
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
], {
  basename: getAppBasePath() || undefined,
});

function App() {
  return <RouterProvider router={router} />;
}

export default App;
