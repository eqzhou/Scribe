/**
 * RequireAuth 路由保护组件
 *
 * 未登录用户访问受保护路由时，重定向至 /login。
 * 登录态由 userStore.isAuthenticated 决定（应用启动时由 App 调用 hydrate 恢复）。
 */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';

export interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default RequireAuth;
