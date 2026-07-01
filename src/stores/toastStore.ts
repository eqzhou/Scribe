/**
 * Toast Store
 *
 * 驱动 ToastContainer 组件的轻量通知状态。
 * 纯内存（不持久化），pushToast 后 4 秒自动消失。
 */
import { create } from 'zustand';
import type { ToastItem } from '../components/feedback/Toast';

/** 单条 Toast 自动消失时长（毫秒） */
const AUTO_DISMISS_MS = 4000;

export interface ToastStore {
  /** 当前显示的 Toast 列表 */
  toasts: ToastItem[];
  /** 推送一条 Toast，4 秒后自动移除 */
  pushToast: (type: ToastItem['type'], message: string) => void;
  /** 手动移除一条 Toast */
  dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  pushToast: (type, message) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }],
    }));
    // 4 秒后自动移除
    window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, AUTO_DISMISS_MS);
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
