/**
 * 设置 Store
 *
 * 管理用户设置：每日字数目标与快捷键映射。
 * 依据技术架构文档第 8.1 节定义。全量持久化。
 *
 * 说明：macOS 的 Cmd 键在快捷键映射中也用 ctrl 表示（简化处理），
 *      由快捷键监听层在运行时按平台转换。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 默认快捷键映射 */
const DEFAULT_SHORTCUTS: Record<string, string> = {
  save: 'ctrl+s',
  bold: 'ctrl+b',
  italic: 'ctrl+i',
  blockquote: 'ctrl+shift+k',
  sceneDivider: 'ctrl+enter',
  focusMode: 'ctrl+shift+f',
  prevChapter: 'ctrl+[',
  nextChapter: 'ctrl+]',
  globalSearch: 'ctrl+k',
  newChapter: 'ctrl+n',
};

export interface SettingStore {
  /** 每日字数目标，默认 3000 */
  dailyGoal: number;
  /** 全局正文字号（px），默认 16，范围 13~20 */
  fontSize: number;
  /** 快捷键映射：action -> 按键组合 */
  shortcuts: Record<string, string>;
  /** 设置每日字数目标 */
  setDailyGoal: (n: number) => void;
  /** 设置全局字号 */
  setFontSize: (n: number) => void;
  /** 更新某一项快捷键 */
  updateShortcut: (action: string, keys: string) => void;
}

export const useSettingStore = create<SettingStore>()(
  persist(
    (set) => ({
      dailyGoal: 3000,
      fontSize: 16,
      shortcuts: { ...DEFAULT_SHORTCUTS },
      setDailyGoal: (n) => set({ dailyGoal: n }),
      setFontSize: (n) => set({ fontSize: n }),
      updateShortcut: (action, keys) =>
        set((state) => ({
          shortcuts: { ...state.shortcuts, [action]: keys },
        })),
    }),
    { name: 'scribe-setting' },
  ),
);
