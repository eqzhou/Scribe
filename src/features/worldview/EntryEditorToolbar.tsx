/**
 * EntryEditorToolbar 世界观条目富文本工具栏
 *
 * 从 EntryEditor 提取的 TipTap 工具栏：B / I / 引文块 / H2 / H3 / §（场景分隔符）。
 * 通过传入的 Editor 实例直接驱动命令，不持有自身状态。
 */
import type { Editor } from '@tiptap/react';
import { cn } from '../../utils/cn';

interface EntryEditorToolbarProps {
  /** TipTap 编辑器实例（未挂载时为 null） */
  editor: Editor | null;
}

/**
 * 富文本编辑器工具栏。
 */
export function EntryEditorToolbar({ editor }: EntryEditorToolbarProps) {
  return (
    <div className="mb-1.5 flex items-center gap-1 rounded-t border border-border bg-muted px-2 py-1.5">
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleBold().run()}
        className={cn(
          'rounded px-2 py-0.5 text-xs transition-colors',
          editor?.isActive('bold')
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
        aria-label="加粗"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        className={cn(
          'rounded px-2 py-0.5 text-xs italic transition-colors',
          editor?.isActive('italic')
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
        aria-label="斜体"
      >
        I
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        className={cn(
          'rounded px-2 py-0.5 text-xs transition-colors',
          editor?.isActive('blockquote')
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
        aria-label="引文块"
      >
        ❝
      </button>
      <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        className={cn(
          'rounded px-2 py-0.5 text-xs transition-colors',
          editor?.isActive('heading', { level: 2 })
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
        aria-label="二级标题"
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        className={cn(
          'rounded px-2 py-0.5 text-xs transition-colors',
          editor?.isActive('heading', { level: 3 })
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
        aria-label="三级标题"
      >
        H3
      </button>
      <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
      <button
        type="button"
        onClick={() => editor?.chain().focus().insertContent({ type: 'sceneDivider' }).run()}
        className="rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="插入场景分隔符"
        title="场景分隔符 (Ctrl+Enter)"
      >
        §
      </button>
    </div>
  );
}

export default EntryEditorToolbar;
