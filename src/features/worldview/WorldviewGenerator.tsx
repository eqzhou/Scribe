/**
 * WorldviewGenerator AI 世界观构建弹窗
 *
 * 在世界观页点击「AI 构建」打开：用户输入主题，调用 executeWorldview 流式
 * 生成当前分类下的条目内容。生成完成后可编辑标题，一键保存为新条目
 * （worldviewRepository.create）。
 *
 * 取消：AbortController 存 useRef，生成中可中断；关闭/卸载时自动 abort。
 */
import { useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { executeWorldview } from '../../lib/aiTools';
import { worldviewRepository } from '../../lib/repositories';
import { useToastStore } from '../../stores';
import type { WorldviewCategory, WorldviewEntry } from '../../types';
import { Modal, Button, Input } from '../../components/ui';

/** 分类中文名映射 */
const CATEGORY_LABEL: Record<WorldviewCategory, string> = {
  geography: '地理',
  history: '历史',
  faction: '势力',
  system: '体系',
  culture: '文化',
  item: '物品',
};

export interface WorldviewGeneratorProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 当前作品 ID */
  bookId: string;
  /** 当前选中的分类 */
  category: WorldviewCategory;
  /** 当前分类下的已有条目（作为 AI 上下文） */
  existing: WorldviewEntry[];
  /** 保存成功回调 */
  onSaved?: () => void;
}

/** 将纯文本按行包装为 HTML 段落（与 executeWorldviewBatch 一致） */
function toHtmlParagraphs(text: string): string {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return '';
  return `<p>${lines.join('</p><p>')}</p>`;
}

/**
 * AI 世界观构建 Modal。
 */
export function WorldviewGenerator({
  open,
  onClose,
  bookId,
  category,
  existing,
  onSaved,
}: WorldviewGeneratorProps) {
  const pushToast = useToastStore((s) => s.pushToast);

  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // AbortController 存 useRef，用于中断 AI 生成
  const abortRef = useRef<AbortController | null>(null);

  // 关闭时中断请求并重置状态
  useEffect(() => {
    if (open) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setSaving(false);
    setDone(false);
    setCopied(false);
    setTopic('');
    setTitle('');
    setContent('');
  }, [open]);

  // 卸载时中断进行中的请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  /** 生成内容：调用 executeWorldview 流式输出 */
  const handleGenerate = async (): Promise<void> => {
    const t = topic.trim();
    if (!t) {
      pushToast('warning', '请输入主题');
      return;
    }
    // 中断上一次未完成的请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setDone(false);
    setContent('');
    setTitle(t);

    const existingSimple = existing.map((e) => ({
      title: e.title,
      content: e.content,
    }));

    try {
      await executeWorldview(
        category,
        t,
        existingSimple,
        (chunk) => {
          if (!controller.signal.aborted) {
            setContent((prev) => prev + chunk);
          }
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setDone(true);
    } catch {
      // executeWorldview 已通过 pushToast 提示错误；用户取消静默处理
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  };

  /** 取消生成：中断进行中的 AI 请求 */
  const handleCancel = (): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  };

  /** 复制生成内容到剪贴板 */
  const handleCopy = async (): Promise<void> => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      pushToast('error', '复制失败');
    }
  };

  /** 保存为新条目：title 用（可编辑的）标题，content 用生成内容 */
  const handleSave = async (): Promise<void> => {
    const finalTitle = title.trim();
    if (!finalTitle) {
      pushToast('warning', '请填写条目标题');
      return;
    }
    if (!content.trim()) {
      pushToast('warning', '内容为空，无法保存');
      return;
    }
    setSaving(true);
    try {
      const html = toHtmlParagraphs(content);
      await worldviewRepository.create({
        bookId,
        category,
        title: finalTitle,
        content: html,
        tags: [],
        relatedCharacterIds: [],
        relatedSceneIds: [],
      });
      pushToast('success', '已保存为新条目');
      onSaved?.();
      onClose();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const categoryLabel = CATEGORY_LABEL[category];
  const busy = loading || saving;

  return (
    <Modal open={open} onClose={onClose} title="AI 世界观构建" width="640px">
      <div className="flex flex-col gap-4">
        {/* 当前分类 */}
        <p className="font-serif text-sm text-muted-foreground">
          当前分类：
          <span className="font-semibold text-foreground">{categoryLabel}</span>
        </p>

        {/* 主题输入 */}
        <Input
          label="主题"
          name="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="如：江南水乡的地理风貌"
          disabled={busy}
        />

        {/* 操作按钮区 */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => void handleGenerate()}
            loading={loading}
            disabled={busy}
          >
            {loading ? '生成中…' : '生成内容'}
          </Button>
          {loading && (
            <Button variant="outline" onClick={handleCancel}>
              取消
            </Button>
          )}
        </div>

        {/* 结果展示区（流式渲染） */}
        {(loading || content) && (
          <div className="flex flex-col gap-1.5">
            <label className="font-serif text-sm text-foreground">生成结果</label>
            <pre className="max-h-[400px] overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background px-4 py-3 font-serif text-sm leading-relaxed text-foreground">
              {content || '生成中…'}
            </pre>
          </div>
        )}

        {/* 生成完成：可编辑标题 + 复制 / 保存 */}
        {done && (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <Input
              label="条目标题"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：江南水乡"
              disabled={saving}
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={
                  copied ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )
                }
                onClick={() => void handleCopy()}
                disabled={saving}
              >
                {copied ? '已复制' : '复制'}
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleSave()}
                loading={saving}
                disabled={busy}
              >
                保存为条目
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default WorldviewGenerator;
