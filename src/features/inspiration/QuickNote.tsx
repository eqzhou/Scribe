/**
 * QuickNote 速记框
 *
 * 顶部快速记录灵感：标题（可选）+ 内容 + 分类 + 标签 + 保存。
 * 保存成功后清空所有字段；标题与内容至少一项非空才可保存。
 */
import { useState, type KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { inspirationRepository } from '../../lib/repositories';
import { Button } from '../../components/ui';
import { useToastStore } from '../../stores';

export interface QuickNoteProps {
  bookId: string;
}

/**
 * 速记框：快速创建灵感卡片。
 */
export function QuickNote({ bookId }: QuickNoteProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const pushToast = useToastStore((s) => s.pushToast);

  const canSave = title.trim().length > 0 || content.trim().length > 0;

  /** 保存灵感并清空表单 */
  const handleSave = async (): Promise<void> => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const tags = tagsInput
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean);
      await inspirationRepository.create({
        bookId,
        title: title.trim(),
        content: content.trim(),
        category: category.trim(),
        tags,
      });
      setTitle('');
      setContent('');
      setCategory('');
      setTagsInput('');
      pushToast('success', '已保存灵感');
    } catch (e) {
      pushToast(
        'error',
        `保存失败：${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  /** Cmd/Ctrl + Enter 快速保存 */
  const handleKeyDown = (e: KeyboardEvent): void => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSave();
    }
  };

  return (
    <div
      className="mb-6 rounded-lg border border-border bg-muted/60 p-4 shadow-soft"
      onKeyDown={handleKeyDown}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="font-brush text-lg text-primary" aria-hidden="true">
          灵
        </span>
        <span className="font-serif text-sm font-semibold tracking-wide text-foreground">
          速记
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          ⌘/Ctrl + Enter 快速保存
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {/* 标题 */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="灵感标题（可选）"
          className="w-full rounded border border-border bg-background px-3 py-1.5 font-serif text-sm text-foreground placeholder:text-muted-foreground focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
          aria-label="灵感标题"
        />

        {/* 内容 */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="随手记下闪过的念头…"
          rows={3}
          className="w-full resize-y rounded border border-border bg-background px-3 py-2 font-serif text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
          aria-label="灵感内容"
        />

        {/* 底部行：分类 + 标签 + 保存 */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="分类"
            className="w-32 rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
            aria-label="灵感分类"
          />
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="标签，逗号分隔"
            className="min-w-[140px] flex-1 rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
            aria-label="灵感标签"
          />
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}

export default QuickNote;
