/**
 * OutlineGenerator AI 大纲生成器
 *
 * 在剧情页时间线 Tab 下，根据当前作品的剧情节点调用 AI 生成章节大纲，
 * 用户可编辑标题后一键批量创建为草稿章节。
 *
 * 流程：
 *   1. 选择章节数（1-20）与卷宗（可选「无卷宗」）
 *   2. buildAIContext 拉取角色 + 世界观，executeOutline 调用 AI 生成 OutlineItem[]
 *   3. 编辑标题（summary 只读展示）
 *   4. 一键创建：循环 chapterRepository.create，status='draft'，order 递增
 *
 * 取消：AbortController 存 useRef，生成中可中断。
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { buildAIContext, executeOutline } from '../../lib/aiTools';
import { chapterRepository, volumeRepository } from '../../lib/repositories';
import { useBook } from '../../hooks';
import { useToastStore } from '../../stores';
import type { OutlineItem } from '../../types/ai';
import type { PlotPoint, Volume } from '../../types';
import { Modal, Button, Input } from '../../components/ui';
import { cn } from '../../utils/cn';

export interface OutlineGeneratorProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 当前作品 ID */
  bookId: string;
  /** 当前作品的剧情节点 */
  plotPoints: PlotPoint[];
}

/** select 通用样式（与 Input 一致：font-sans text-sm h-9） */
const selectCls = cn(
  'w-full h-9 rounded-md border border-border bg-background px-3 py-2 font-sans text-sm text-foreground',
  'transition-all duration-200 ease-out',
  'focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20',
  'disabled:cursor-not-allowed disabled:opacity-60',
);

/** select 标签样式（对齐 Input label） */
const selectLabelCls = 'block font-sans text-sm font-medium text-foreground mb-1.5';

/**
 * AI 大纲生成器 Modal。
 */
export function OutlineGenerator({
  open,
  onClose,
  bookId,
  plotPoints,
}: OutlineGeneratorProps) {
  const book = useBook();
  const pushToast = useToastStore((s) => s.pushToast);

  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [chapterCount, setChapterCount] = useState(5);
  const [volumeId, setVolumeId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [outline, setOutline] = useState<OutlineItem[]>([]);

  // AbortController 存 useRef，用于中断 AI 生成
  const abortRef = useRef<AbortController | null>(null);

  // 打开时拉取卷宗列表；关闭时重置状态并中断进行中的请求
  useEffect(() => {
    if (open) {
      let cancelled = false;
      volumeRepository
        .list(bookId)
        .then((list) => {
          if (!cancelled) setVolumes(list);
        })
        .catch(() => {
          // 静默失败，卷宗下拉退化为仅有「无卷宗」选项
        });
      return () => {
        cancelled = true;
      };
    }
    // 关闭：中断请求 + 重置状态
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setCreating(false);
    setOutline([]);
    setChapterCount(5);
    setVolumeId('');
    setVolumes([]);
  }, [open, bookId]);

  /** 生成大纲 */
  const handleGenerate = async (): Promise<void> => {
    if (!book) {
      pushToast('error', '未找到当前作品信息');
      return;
    }
    if (plotPoints.length === 0) {
      pushToast('warning', '当前作品尚无剧情节点，请先在剧情线中创建节点');
      return;
    }
    const count = Math.max(
      1,
      Math.min(20, Number.isFinite(chapterCount) ? Math.floor(chapterCount) : 5),
    );
    // 中断上一次未完成的请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setOutline([]);
    try {
      const context = await buildAIContext(bookId, book.title, book.synopsis);
      const volumeTitle = volumeId
        ? volumes.find((v) => v.id === volumeId)?.title
        : undefined;
      const items = await executeOutline(
        bookId,
        volumeTitle,
        plotPoints.map((p) => ({ title: p.title, description: p.description })),
        context.characters,
        context.worldview,
        count,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setOutline(items);
      if (items.length === 0) {
        pushToast('warning', 'AI 未返回有效大纲');
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      pushToast('error', `大纲生成失败：${msg}`);
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

  /** 编辑某项标题 */
  const handleTitleChange = (idx: number, title: string): void => {
    setOutline((prev) => prev.map((it, i) => (i === idx ? { ...it, title } : it)));
  };

  /** 一键创建章节：循环 chapterRepository.create，order 递增 */
  const handleCreateChapters = async (): Promise<void> => {
    if (outline.length === 0) return;
    setCreating(true);
    try {
      // 拉取最新章节列表，计算起始 order（max + 1）
      const existing = await chapterRepository.list(bookId);
      const startOrder =
        existing.length === 0
          ? 0
          : existing.reduce((mx, c) => Math.max(mx, c.order), -1) + 1;
      let created = 0;
      for (let i = 0; i < outline.length; i++) {
        const item = outline[i];
        await chapterRepository.create({
          bookId,
          volumeId: volumeId || undefined,
          title: item.title || `第${startOrder + i + 1}章`,
          content: '',
          summary: item.summary,
          status: 'draft',
          wordCount: 0,
          order: startOrder + i,
        });
        created++;
      }
      pushToast('success', `已创建 ${created} 个章节`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast('error', `章节创建失败：${msg}`);
    } finally {
      setCreating(false);
    }
  };

  const busy = loading || creating;
  const hasResult = outline.length > 0;

  return (
    <Modal open={open} onClose={onClose} title="AI 生成大纲" width="640px">
      <div className="flex flex-col gap-4">
        {/* 配置区 */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="章节数"
            type="number"
            min={1}
            max={20}
            value={chapterCount}
            onChange={(e) => setChapterCount(Number(e.target.value))}
            disabled={busy}
          />
          <div className="w-full">
            <label className={selectLabelCls}>卷宗</label>
            <select
              value={volumeId}
              onChange={(e) => setVolumeId(e.target.value)}
              disabled={busy}
              className={selectCls}
            >
              <option value="">无卷宗</option>
              {volumes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 操作按钮区 */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => void handleGenerate()}
            loading={loading}
            disabled={busy || plotPoints.length === 0}
            icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          >
            {loading ? '生成中…' : '生成大纲'}
          </Button>
          {loading && (
            <Button variant="outline" onClick={handleCancel}>
              取消
            </Button>
          )}
          {hasResult && !loading && (
            <Button
              variant="secondary"
              onClick={() => void handleCreateChapters()}
              loading={creating}
              disabled={busy}
            >
              {creating ? '创建中…' : '一键创建章节'}
            </Button>
          )}
        </div>

        {/* 剧情节点提示 */}
        {plotPoints.length === 0 && (
          <p className="font-sans text-[12px] text-muted-foreground">
            当前作品尚无剧情节点，无法生成大纲。请先在「剧情线」中编排节点。
          </p>
        )}

        {/* 生成进度 */}
        {loading && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2.5">
            <Loader2 className="h-4 w-4 animate-spin text-secondary" aria-hidden="true" />
            <span className="font-sans text-xs text-muted-foreground">
              AI 正在根据 {plotPoints.length} 个剧情节点生成 {chapterCount} 章大纲…
            </span>
          </div>
        )}

        {/* 结果列表 */}
        {hasResult && (
          <div className="flex flex-col gap-2">
            <span className="font-sans text-[12px] text-muted-foreground">
              共 {outline.length} 项 · 标题可编辑
            </span>
            <ol className="flex flex-col gap-2">
              {outline.map((item, idx) => (
                <li
                  key={idx}
                  className="rounded-md border border-border bg-background px-3 py-2.5"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="shrink-0 font-sans text-[12px] font-medium text-muted-foreground">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <Input
                      value={item.title}
                      onChange={(e) => handleTitleChange(idx, e.target.value)}
                      disabled={creating}
                      className="h-8"
                    />
                  </div>
                  <p className="font-sans text-xs leading-relaxed text-muted-foreground">
                    {item.summary || '（无摘要）'}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default OutlineGenerator;
