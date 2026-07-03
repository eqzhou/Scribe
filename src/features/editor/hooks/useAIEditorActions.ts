/**
 * useAIEditorActions
 *
 * 集中管理编辑器中的 AI 写作操作：
 * - 续写（光标处续写下文）
 * - 改写 / 润色 / 扩写（选中文本，弹风格选择）
 * - 全文生成（按大纲生成整章正文）
 * - 取消生成
 *
 * 同时托管风格选择弹窗、全文生成弹窗的开关状态与全文大纲文本，
 * 供主组件在 JSX 中渲染对应 Modal。
 */
import { useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { db } from '../../../lib/db';
import {
  executeContinue,
  executeRewrite,
  executeFulltextEditor,
  executeCharacterExtract,
} from '../../../lib/aiTools';
import { useAIStore, useToastStore } from '../../../stores';
import type { RewriteStyle } from '../../../types/ai';

export interface StyleModalState {
  action: 'rewrite' | 'polish' | 'expand';
  text: string;
}

export interface UseAIEditorActionsArgs {
  editor: Editor | null;
  /** 主组件传入的 bookId（来自路由/props） */
  bookId: string;
  /** store 中当前作品 ID（可能为 null，回退使用 bookId） */
  currentBookId: string | null;
  chapterId: string;
  chapterTitle: string;
  /** 章节大纲文本，用于在打开全文生成弹窗时预填 */
  outlineText: string;
}

export interface UseAIEditorActionsReturn {
  aiBusy: boolean;
  styleModalOpen: StyleModalState | null;
  setStyleModalOpen: (s: StyleModalState | null) => void;
  fulltextModalOpen: boolean;
  setFulltextModalOpen: (open: boolean) => void;
  fulltextOutline: string;
  setFulltextOutline: (text: string) => void;
  handleAIContinue: () => Promise<void>;
  handleAIRewriteAction: (action: 'rewrite' | 'polish' | 'expand') => void;
  handleConfirmRewrite: (style: RewriteStyle | undefined) => Promise<void>;
  handleAIFulltext: () => void;
  handleConfirmFulltext: () => Promise<void>;
  handleAICancel: () => void;
}

/**
 * 获取当前作品信息（用于 AI 上下文）
 */
async function getBookInfo(
  bookId: string,
  currentBookId: string | null,
): Promise<{ id: string; title: string; synopsis: string }> {
  const id = currentBookId ?? bookId;
  const book = await db.books.get(id);
  return {
    id,
    title: book?.title ?? '未命名作品',
    synopsis: book?.synopsis ?? '',
  };
}

export function useAIEditorActions({
  editor,
  bookId,
  currentBookId,
  chapterId,
  chapterTitle,
  outlineText,
}: UseAIEditorActionsArgs): UseAIEditorActionsReturn {
  const aiStatus = useAIStore((s) => s.status);
  const aiBusy = aiStatus === 'loading' || aiStatus === 'streaming';

  const [styleModalOpen, setStyleModalOpen] = useState<StyleModalState | null>(null);
  const [fulltextModalOpen, setFulltextModalOpen] = useState(false);
  const [fulltextOutline, setFulltextOutline] = useState('');

  // 延迟角色提取的 timer，组件卸载时清理避免 state-on-unmounted
  const extractTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (extractTimerRef.current !== null) window.clearTimeout(extractTimerRef.current);
    };
  }, []);

  /** AI 续写：在光标处续写下文 */
  const handleAIContinue = async (): Promise<void> => {
    if (!editor || aiBusy) return;
    try {
      const book = await getBookInfo(bookId, currentBookId);
      await executeContinue(editor, book.id, chapterId, book.title, book.synopsis);
    } catch {
      // 错误已在 executeContinue 内通过 toast 提示
    }
  };

  /** AI 改写/润色/扩写：需选中文本，弹出风格选择 */
  const handleAIRewriteAction = (action: 'rewrite' | 'polish' | 'expand'): void => {
    if (!editor || aiBusy) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');
    if (!selectedText.trim()) {
      useToastStore.getState().pushToast('warning', '请先选中要处理的文本');
      return;
    }
    setStyleModalOpen({ action, text: selectedText });
  };

  /** 确认风格后执行改写 */
  const handleConfirmRewrite = async (style: RewriteStyle | undefined): Promise<void> => {
    if (!editor || !styleModalOpen) return;
    const { action, text } = styleModalOpen;
    setStyleModalOpen(null);
    try {
      const book = await getBookInfo(bookId, currentBookId);
      await executeRewrite(editor, text, action, style, book.id, book.title, book.synopsis);
    } catch {
      // 错误已提示
    }
  };

  /** AI 全文生成：打开弹窗输入大纲 */
  const handleAIFulltext = (): void => {
    if (!editor || aiBusy) return;
    setFulltextOutline(outlineText || '');
    setFulltextModalOpen(true);
  };

  /** 确认大纲后执行全文生成 */
  const handleConfirmFulltext = async (): Promise<void> => {
    if (!editor) return;
    setFulltextModalOpen(false);
    try {
      const book = await getBookInfo(bookId, currentBookId);
      await executeFulltextEditor(
        editor,
        book.id,
        chapterId,
        chapterTitle,
        fulltextOutline,
        book.title,
        book.synopsis,
      );

      // 全文生成完成后，异步触发角色提取（不阻塞主流程，失败静默处理）
      // 使用 setTimeout 等待 ghost text 内容稳定，再用编辑器纯文本做提取
      if (extractTimerRef.current !== null) window.clearTimeout(extractTimerRef.current);
      extractTimerRef.current = window.setTimeout(async () => {
        try {
          // 检查 editor 是否仍可用（用户可能在 1.5s 内切换章节或卸载组件）
          if (!editor || editor.isDestroyed) return;
          const content = editor.getText();
          if (!content || content.length < 50) return;
          await executeCharacterExtract(
            book.id,
            chapterTitle,
            content.slice(0, 8000), // 限制长度，避免超长内容
          );
        } catch {
          // 角色提取失败不影响主流程，错误已在 executeCharacterExtract 内 toast
        }
      }, 1500);
    } catch {
      // 错误已在 executeFulltextEditor 内通过 toast 提示
    }
  };

  /** 取消 AI 请求 */
  const handleAICancel = (): void => {
    useAIStore.getState().cancel();
    editor?.commands.rejectGhostText();
  };

  return {
    aiBusy,
    styleModalOpen,
    setStyleModalOpen,
    fulltextModalOpen,
    setFulltextModalOpen,
    fulltextOutline,
    setFulltextOutline,
    handleAIContinue,
    handleAIRewriteAction,
    handleConfirmRewrite,
    handleAIFulltext,
    handleConfirmFulltext,
    handleAICancel,
  };
}
