/**
 * 用户 Store
 *
 * 管理当前登录用户的认证态：
 * - token / user 持久化到 localStorage（key: scribe-token, scribe-user）
 * - isAuthenticated 派生态，供 RequireAuth 等组件消费
 * - hydrate() 在应用启动时从 localStorage 恢复认证态
 *
 * 注：仅存 token 与 user 信息，不存业务数据。
 */
import { create } from 'zustand';
import type { User } from '../types';

/** localStorage key */
const TOKEN_KEY = 'scribe-token';
const USER_KEY = 'scribe-user';

export interface UserState {
  /** 当前登录用户，未登录时为 null */
  user: User | null;
  /** 认证 token，未登录时为 null */
  token: string | null;
  /** 是否已登录（派生态） */
  isAuthenticated: boolean;
  /** 设置认证态：写入 localStorage 并更新 store */
  setAuth: (token: string, user: User) => void;
  /** 登出：清除 localStorage 与 store */
  logout: () => void;
  /** 从 localStorage 恢复认证态（应用初始化时调用） */
  hydrate: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },
  hydrate: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson) as User;
        set({ token, user, isAuthenticated: true });
      } catch {
        // JSON 解析失败：清除脏数据，保持未登录态
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
  },
}));
