/**
 * 编辑器 Store
 *
 * 管理章节编辑器状态：当前章节、未保存内容、专注模式与自动保存状态。
 * 依据技术架构文档第 8.1 节定义。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SaveStatus } from '../types';

export interface EditorStore {
  /** 当前编辑的章节 ID */
  currentChapterId: string | null;
  /** 尚未持久化的草稿内容（null 表示无未保存内容） */
  unsavedContent: string | null;
  /** 专注模式开关 */
  focusMode: boolean;
  /** 自动保存状态 */
  saveStatus: SaveStatus;
  /** 最近一次保存成功的时间戳 */
  lastSavedAt: number | null;
  /** 设置当前章节 */
  setCurrentChapter: (id: string | null) => void;
  /** 设置未保存内容 */
  setUnsavedContent: (content: string) => void;
  /** 切换专注模式 */
  toggleFocusMode: () => void;
  /** 设置保存状态 */
  setSaveStatus: (status: SaveStatus) => void;
  /** 设置最近一次保存时间 */
  setLastSavedAt: (time: number) => void;
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set) => ({
      currentChapterId: null,
      unsavedContent: null,
      focusMode: false,
      saveStatus: 'idle',
      lastSavedAt: null,
      setCurrentChapter: (id) => set({ currentChapterId: id }),
      setUnsavedContent: (content) => set({ unsavedContent: content }),
      toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
      setSaveStatus: (status) => set({ saveStatus: status }),
      setLastSavedAt: (time) => set({ lastSavedAt: time }),
    }),
    {
      name: 'scribe-editor',
      // 仅持久化 currentChapterId 与 focusMode，避免草稿与保存状态被错误恢复
      partialize: (state) => ({
        currentChapterId: state.currentChapterId,
        focusMode: state.focusMode,
      }),
    },
  ),
);
