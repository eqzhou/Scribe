/**
 * 全局快捷键 Hook
 *
 * 监听全局键盘事件并触发对应行为：
 *   - Alt+0：切换到项目（作品选择）
 *   - Alt+1~7：切换到项目内功能模块（工作台/世界观/角色/剧情/场景/写作/灵感）
 *   - Alt+8：打开设置页
 *   - Ctrl/Cmd+K：打开全局搜索面板
 *   - Ctrl/Cmd+N：在当前作品下新建章节（实际调用 chapterRepository.create）
 *
 * 注：编辑器内部的快捷键（Ctrl+S / B / I / Shift+K / [ / ] 等）由 TipTap 编辑器组件
 * 与 EditorPage 自行监听，此 hook 仅在 App 顶层调用一次，不接管编辑器内的快捷键。
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chapterRepository, volumeRepository } from '../lib/repositories';
import { useUIStore, useBookStore, useEditorStore, useToastStore } from '../stores';

/** Alt+0 切换到项目入口；Alt+1~7 切换项目内功能模块；Alt+8 打开设置 */
const PROJECT_ROUTE = '/projects';
const NAV_ROUTES = [
  '/dashboard',
  '/worldview',
  '/characters',
  '/plot',
  '/scenes',
  '/editor',
  '/inspiration',
] as const;
const SETTINGS_ROUTE = '/settings';

/** 从键盘事件中提取小写字母键名（用于 K / N 等判断） */
function letterKey(e: KeyboardEvent): string {
  return e.key.toLowerCase();
}

/**
 * 注册全局快捷键。应在应用根组件中调用一次。
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const setGlobalSearchOpen = useUIStore((s) => s.setGlobalSearchOpen);

  useEffect(() => {
    const handler = async (e: KeyboardEvent): Promise<void> => {
      // Alt+0：切换到项目入口；Alt+1~7 切换项目内功能；Alt+8 打开设置
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (e.code === 'Digit0') {
          e.preventDefault();
          navigate(PROJECT_ROUTE);
          return;
        }
        if (e.code === 'Digit8') {
          e.preventDefault();
          navigate(SETTINGS_ROUTE);
          return;
        }
        const match = /^Digit([1-7])$/.exec(e.code);
        if (match) {
          const idx = Number.parseInt(match[1], 10) - 1;
          e.preventDefault();
          navigate(NAV_ROUTES[idx]);
          return;
        }
      }

      // Ctrl/Cmd 组合键（mac 用 metaKey，Windows/Linux 用 ctrlKey）
      const meta = e.metaKey || e.ctrlKey;
      if (!meta || e.shiftKey || e.altKey) return;

      const key = letterKey(e);
      // Ctrl/Cmd+K：打开全局搜索
      if (key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(true);
        return;
      }
      // Ctrl/Cmd+N：在当前作品下新建章节
      if (key === 'n') {
        e.preventDefault();
        const bookId = useBookStore.getState().currentBookId;
        if (!bookId) {
          useToastStore.getState().pushToast('warning', '请先选择作品后再新建章节');
          navigate(PROJECT_ROUTE);
          return;
        }
        try {
          const [volumes, chapters] = await Promise.all([
            volumeRepository.list(bookId),
            chapterRepository.list(bookId),
          ]);
          const volId = volumes[0]?.id;
          const siblings = volId
            ? chapters.filter((c) => c.volumeId === volId)
            : chapters.filter((c) => !c.volumeId);
          const nextOrder =
            siblings.length === 0 ? 0 : Math.max(...siblings.map((c) => c.order)) + 1;
          const chapter = await chapterRepository.create({
            bookId,
            volumeId: volId,
            title: `第${chapters.length + 1}章`,
            content: '',
            summary: '',
            status: 'draft',
            wordCount: 0,
            order: nextOrder,
          });
          useEditorStore.getState().setCurrentChapter(chapter.id);
          useToastStore.getState().pushToast('success', `已新建章节「${chapter.title}」`);
          navigate('/editor');
        } catch (err) {
          useToastStore
            .getState()
            .pushToast('error', `新建章节失败：${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, setGlobalSearchOpen]);
}
