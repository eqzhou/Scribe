/**
 * DialogueGenerator AI 角色对话生成器
 *
 * 在角色页以 Modal 形式提供角色间对话片段生成：
 * - 选择主角、场景描述、对话主题与其他角色
 * - 流式渲染 AI 生成的对话文本（onChunk 累加）
 * - 支持取消（AbortController 中断流式请求）与复制结果
 *
 * 调用 src/lib/aiTools.ts 的 executeDialogue，错误由其内部通过
 * useToastStore.pushToast('error', ...) 统一提示。
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2, Copy, Check } from 'lucide-react';
import { Modal, Button } from '../../components/ui';
import { executeDialogue } from '../../lib/aiTools';
import { useToastStore } from '../../stores';
import type { Character } from '../../types';
import { cn } from '../../utils/cn';

export interface DialogueGeneratorProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 当前作品的角色列表 */
  characters: Character[];
  /** 当前作品 ID（用于在作品切换时重置表单） */
  bookId: string;
}

/**
 * AI 角色对话生成器 Modal。
 */
export function DialogueGenerator({
  open,
  onClose,
  characters,
  bookId,
}: DialogueGeneratorProps) {
  const pushToast = useToastStore((s) => s.pushToast);
  const [mainId, setMainId] = useState('');
  const [scene, setScene] = useState('');
  const [topic, setTopic] = useState('');
  const [otherIds, setOtherIds] = useState<string[]>([]);
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 打开或切换作品时重置表单
  useEffect(() => {
    if (!open) return;
    setMainId('');
    setScene('');
    setTopic('');
    setOtherIds([]);
    setOutput('');
    setCopied(false);
  }, [open, bookId]);

  // 关闭或卸载时中断在途请求
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [open]);

  /** 切换其他角色勾选 */
  const handleToggleOther = (id: string): void => {
    setOtherIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  /** 主角变更时同步清理 otherIds 中的同 ID 项 */
  const handleMainChange = (id: string): void => {
    setMainId(id);
    setOtherIds((prev) => prev.filter((x) => x !== id));
  };

  /** 生成对话：构建参数 + 流式累加 output */
  const handleGenerate = async (): Promise<void> => {
    if (!mainId) {
      pushToast('warning', '请选择主角');
      return;
    }
    if (!topic.trim()) {
      pushToast('warning', '请输入对话主题');
      return;
    }
    const main = characters.find((c) => c.id === mainId);
    if (!main) return;

    // 中断在途请求后再发起新请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setOutput('');
    setCopied(false);

    try {
      await executeDialogue(
        {
          name: main.name,
          personality: main.personality,
          background: main.background,
        },
        scene.trim() || '未指定场景',
        topic.trim(),
        otherIds
          .map((id) => characters.find((c) => c.id === id))
          .filter((c): c is Character => Boolean(c))
          .map((c) => ({ name: c.name, personality: c.personality })),
        (chunk) => {
          setOutput((prev) => prev + chunk);
        },
        controller.signal,
      );
    } catch {
      // 错误已在 executeDialogue 内通过 toast 提示
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  /** 取消生成：中断在途请求 */
  const handleCancel = (): void => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setLoading(false);
  };

  /** 复制结果到剪贴板 */
  const handleCopy = async (): Promise<void> => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      pushToast('success', '已复制到剪贴板');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      pushToast('error', '复制失败');
    }
  };

  /** 关闭 Modal：先中断生成再回调 */
  const handleClose = (): void => {
    handleCancel();
    onClose();
  };

  const others = characters.filter((c) => c.id !== mainId);

  return (
    <Modal open={open} onClose={handleClose} title="AI 角色对话" width="640px">
      <div className="flex flex-col gap-4">
        {/* ============ 主角选择 ============ */}
        <div>
          <label className="mb-1.5 block font-serif text-sm text-foreground">
            主角
          </label>
          <select
            value={mainId}
            onChange={(e) => handleMainChange(e.target.value)}
            disabled={loading}
            className={cn(
              'w-full rounded-md border border-border bg-background px-3 py-2',
              'font-serif text-sm text-foreground',
              'transition-all duration-200 ease-out',
              'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            <option value="">选择主角…</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* ============ 场景描述 ============ */}
        <div>
          <label className="mb-1.5 block font-serif text-sm text-foreground">
            场景描述
          </label>
          <textarea
            value={scene}
            onChange={(e) => setScene(e.target.value)}
            placeholder="如：客栈夜半，烛火摇曳"
            disabled={loading}
            className={cn(
              'w-full rounded-md border border-border bg-background px-3 py-2',
              'font-serif text-sm leading-relaxed text-foreground',
              'placeholder:text-muted-foreground',
              'transition-all duration-200 ease-out',
              'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20',
              'disabled:cursor-not-allowed disabled:opacity-60',
              'min-h-[72px] resize-y',
            )}
          />
        </div>

        {/* ============ 对话主题 ============ */}
        <div>
          <label className="mb-1.5 block font-serif text-sm text-foreground">
            对话主题
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="如：试探对方身份"
            disabled={loading}
            className={cn(
              'w-full rounded-md border border-border bg-background px-3 py-2',
              'font-serif text-sm text-foreground',
              'placeholder:text-muted-foreground',
              'transition-all duration-200 ease-out',
              'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          />
        </div>

        {/* ============ 其他角色（多选） ============ */}
        <div>
          <label className="mb-1.5 block font-serif text-sm text-foreground">
            其他角色
          </label>
          {others.length === 0 ? (
            <p className="text-xs font-sans text-muted-foreground">
              {mainId ? '暂无其他可选角色' : '请先选择主角'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 rounded-md border border-border bg-muted/30 p-2">
              {others.map((c) => {
                const checked = otherIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1',
                      'text-xs font-sans transition-colors',
                      'focus-within:ring-2 focus-within:ring-ring/20',
                      checked
                        ? 'border-secondary/60 bg-secondary/15 text-secondary'
                        : 'border-border bg-background text-foreground hover:bg-accent',
                      loading && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleOther(c.id)}
                      disabled={loading}
                      className="h-3 w-3"
                    />
                    {c.name}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* ============ 操作按钮 ============ */}
        <div className="flex items-center justify-end gap-2">
          {loading && (
            <Button variant="ghost" size="md" onClick={handleCancel}>
              取消
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={() => void handleGenerate()}
            loading={loading}
            disabled={loading}
          >
            {loading ? '生成中…' : '生成对话'}
          </Button>
        </div>

        {/* ============ 结果展示区 ============ */}
        {(output || loading) && (
          <div className="rounded-md border border-secondary/30 bg-secondary/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[12px] font-sans text-secondary">
                {loading && (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                )}
                {loading ? '生成中…' : 'AI 输出'}
              </span>
              {output && !loading && (
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-sans text-muted-foreground transition-colors hover:bg-foreground/5"
                  aria-label="复制结果"
                >
                  {copied ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  )}
                  {copied ? '已复制' : '复制'}
                </button>
              )}
            </div>
            <pre
              className={cn(
                'whitespace-pre-wrap break-words font-serif',
                'text-sm leading-relaxed text-foreground',
                'max-h-[400px] overflow-y-auto',
              )}
            >
              {output || (loading ? '正在生成…' : '')}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default DialogueGenerator;
