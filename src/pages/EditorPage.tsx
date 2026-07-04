/**
 * 写作页面
 *
 * 三栏布局：ChapterTree（240px）| WritingCanvas（flex-1）| SettingSidebar（280px）。
 * 专注模式：Ctrl+Shift+F 切换，左右栏通过 motion.div 折叠为 0 宽。
 * 响应式：md 以下左栏折叠为抽屉（浮动按钮唤起）；lg 以下右栏折叠为抽屉。
 * 章节选择：从 editorStore.currentChapterId 读取；无值时默认选第一章。
 * 无章节时引导新建；无作品时引导选择作品。
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { List, BookOpen } from 'lucide-react';
import { chapterRepository } from '../lib/repositories';
import { useApiQuery } from '../hooks/useApiQuery';
import { useBook, useChapters } from '../hooks';
import { useEditorStore } from '../stores';
import type { Chapter } from '../types';
import { EmptyState } from '../components/ui';
import { ChapterTree } from '../features/editor/ChapterTree';
import { WritingCanvas } from '../features/editor/WritingCanvas';
import { SettingSidebar } from '../features/editor/SettingSidebar';

/**
 * 写作页面：三栏编辑器布局 + 专注模式 + 章节选择。
 */
export default function EditorPage() {
  const book = useBook();
  const bookId = book?.id ?? null;
  const chapters = useChapters();

  const currentChapterId = useEditorStore((s) => s.currentChapterId);
  const setCurrentChapter = useEditorStore((s) => s.setCurrentChapter);
  const focusMode = useEditorStore((s) => s.focusMode);
  const toggleFocusMode = useEditorStore((s) => s.toggleFocusMode);

  // 小屏抽屉态：左栏（md 以下）/ 右栏（lg 以下）以浮层抽屉形式唤起
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  // 实时监听当前章节对象（章节内容变化时自动刷新）
  const chapter = useApiQuery<Chapter | null>(
    async () => {
      if (!currentChapterId) return null;
      return (await chapterRepository.get(currentChapterId)) ?? null;
    },
    [currentChapterId],
  ) ?? null;

  // 章节选择修正：
  // - 无 currentChapterId 时默认选第一章
  // - currentChapterId 指向已删除章节时回退到第一章（避免永久卡在加载态）
  useEffect(() => {
    if (chapters.length === 0) return;
    const exists = chapters.some((c) => c.id === currentChapterId);
    if (!exists) {
      setCurrentChapter(chapters[0].id);
    }
  }, [currentChapterId, chapters, setCurrentChapter]);

  // 专注模式快捷键：Ctrl+Shift+F
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFocusMode();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFocusMode]);

  // 章节切换快捷键：Ctrl+[ 上一章，Ctrl+] 下一章
  useEffect(() => {
    if (chapters.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta || e.shiftKey || e.altKey) return;
      if (e.key !== '[' && e.key !== ']') return;
      const idx = chapters.findIndex((c) => c.id === currentChapterId);
      if (idx === -1) return;
      e.preventDefault();
      if (e.key === '[' && idx > 0) {
        setCurrentChapter(chapters[idx - 1].id);
      } else if (e.key === ']' && idx < chapters.length - 1) {
        setCurrentChapter(chapters[idx + 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chapters, currentChapterId, setCurrentChapter]);

  // 无作品
  if (!bookId) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          glyph="卷"
          title="尚未选择作品"
          description="请在项目页选择或创建一部作品后，再开始写作。"
        />
      </div>
    );
  }

  // 无章节：引导新建第一章
  if (chapters.length === 0) {
    const handleNew = async (): Promise<void> => {
      const created = await chapterRepository.create({
        bookId,
        title: '第1章',
        content: '',
        summary: '',
        status: 'draft',
        wordCount: 0,
        order: 0,
      });
      setCurrentChapter(created.id);
    };
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          glyph="墨"
          title="尚无章节"
          description="提笔即千言。新建第一章，开启你的故事。"
          action={{ label: '新建第一章', onClick: handleNew }}
        />
      </div>
    );
  }

  // 章节已删除但 currentChapterId 未更新：回退到第一章
  if (!chapter) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          glyph="墨"
          title="章节加载中"
          description="正在准备写作环境…"
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* 左栏：桌面态（md+ 显示，focusMode 控制宽度动画） */}
      <motion.div
        animate={
          focusMode
            ? { width: 0, opacity: 0 }
            : { width: 240, opacity: 1 }
        }
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        className="hidden h-full shrink-0 overflow-hidden md:block"
        aria-hidden={focusMode}
      >
        <ChapterTree bookId={bookId} />
      </motion.div>

      {/* 左栏：移动抽屉态（md 以下，leftSidebarOpen 控制） */}
      <AnimatePresence>
        {leftSidebarOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default bg-overlay md:hidden"
              aria-label="关闭章节树"
              onClick={() => setLeftSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed left-0 top-0 z-50 h-full w-[240px] overflow-hidden bg-background shadow-lifted md:hidden"
            >
              <ChapterTree bookId={bookId} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 中栏：写作画布 */}
      <WritingCanvas chapter={chapter} bookId={bookId} />

      {/* 右栏：桌面态（lg+ 显示，focusMode 控制宽度动画） */}
      <motion.div
        animate={
          focusMode
            ? { width: 0, opacity: 0 }
            : { width: 280, opacity: 1 }
        }
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        className="hidden h-full shrink-0 overflow-hidden lg:block"
        aria-hidden={focusMode}
      >
        <SettingSidebar bookId={bookId} />
      </motion.div>

      {/* 右栏：移动抽屉态（lg 以下，rightSidebarOpen 控制） */}
      <AnimatePresence>
        {rightSidebarOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default bg-overlay lg:hidden"
              aria-label="关闭设定侧栏"
              onClick={() => setRightSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed right-0 top-0 z-50 h-full w-[280px] overflow-hidden bg-background shadow-lifted lg:hidden"
            >
              <SettingSidebar bookId={bookId} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 浮动按钮：唤起左栏抽屉（仅 md 以下可见） */}
      <button
        type="button"
        onClick={() => setLeftSidebarOpen(true)}
        className="fixed bottom-6 left-6 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-lifted transition-all duration-200 hover:border-secondary hover:bg-hover-inverse hover:text-hover-inverse-fg md:hidden"
        aria-label="打开章节树"
      >
        <List className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* 浮动按钮：唤起右栏抽屉（仅 lg 以下可见） */}
      <button
        type="button"
        onClick={() => setRightSidebarOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-lifted transition-all duration-200 hover:border-secondary hover:bg-hover-inverse hover:text-hover-inverse-fg lg:hidden"
        aria-label="打开设定侧栏"
      >
        <BookOpen className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
