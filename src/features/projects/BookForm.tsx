/**
 * BookForm 作品新建/编辑表单弹窗
 *
 * 基于 Modal 实现，承载作品元信息编辑：
 * - 书名、副标题、简介（Textarea）
 * - 类型（select：武侠/玄幻/都市/历史/科幻/言情/悬疑/其他）
 * - 目标字数（number）
 * - 封面色（6 个预设色块选择器）
 * - 每日目标（number）
 *
 * 保存时调用 bookRepository.create 或 update，并触发 onSaved 回调。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, AlertTriangle, Settings } from 'lucide-react';
import { Modal } from '../../components/ui';
import { Button, Input, Textarea } from '../../components/ui';
import { bookRepository } from '../../lib/repositories';
import { executeWorldviewBatch } from '../../lib/aiTools';
import { useToastStore, useAIModelStore } from '../../stores';
import type { Book } from '../../types';
import { cn } from '../../utils/cn';

export interface BookFormProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 编辑目标作品；为 null 时表示新建 */
  book: Book | null;
  /** 保存成功后回调（参数为保存后的作品） */
  onSaved: (book: Book) => void;
}

/** 作品类型选项 */
const GENRE_OPTIONS: string[] = [
  '武侠',
  '玄幻',
  '都市',
  '历史',
  '科幻',
  '言情',
  '悬疑',
  '其他',
];

/** 预设封面色：覆盖墨绿、朱砂、铜金、墨黑、雪青、青黛六种主调 */
const COVER_PRESETS: string[] = [
  '#3d4a3d', // 墨绿
  '#c8553d', // 朱砂
  '#b08d57', // 铜金
  '#1a1612', // 墨黑
  '#7a8ca0', // 雪青
  '#5a6b8a', // 青黛
];

/** 表单字段默认值（新建场景使用） */
const DEFAULT_FORM: BookFormState = {
  title: '',
  subtitle: '',
  synopsis: '',
  genre: '武侠',
  targetWords: 500000,
  coverColor: COVER_PRESETS[0],
  dailyGoal: 3000,
};

/** 表单状态结构 */
interface BookFormState {
  title: string;
  subtitle: string;
  synopsis: string;
  genre: string;
  targetWords: number;
  coverColor: string;
  dailyGoal: number;
}

/**
 * 作品新建/编辑表单弹窗。
 */
export function BookForm({ open, onClose, book, onSaved }: BookFormProps) {
  const [form, setForm] = useState<BookFormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [generatingWorld, setGeneratingWorld] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pushToast = useToastStore((s) => s.pushToast);
  const navigate = useNavigate();
  const models = useAIModelStore((s) => s.models);
  const modelError = useAIModelStore((s) => s.error);

  // 新建模式下检查 AI 大模型是否已配置（编辑模式不检查，作品已存在）
  const isCreateMode = !book;
  const enabledModelCount = models.filter((m) => m.enabled).length;
  const hasEnabledModel = enabledModelCount > 0;
  // 模型未配置：无启用模型，且非加载中、无服务端错误（避免误判加载态为"未配置"）
  const modelUnconfigured = isCreateMode && !hasEnabledModel && !modelError;

  // book 变化或弹窗打开时同步表单
  useEffect(() => {
    if (!open) return;
    if (book) {
      // 编辑模式：从作品回填表单
      setForm({
        title: book.title,
        subtitle: book.subtitle,
        synopsis: book.synopsis,
        genre: book.genre,
        targetWords: book.targetWords,
        coverColor: book.coverColor,
        dailyGoal: book.dailyGoal,
      });
    } else {
      // 新建模式：重置为默认值
      setForm(DEFAULT_FORM);
    }
    setError(null);
  }, [open, book]);

  /** 通用字段更新 */
  const updateField = <K extends keyof BookFormState>(
    key: K,
    value: BookFormState[K],
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 提交表单：校验 + 调用 Repository */
  const handleSubmit = async (): Promise<void> => {
    // 校验书名必填
    if (!form.title.trim()) {
      setError('请填写作品名称');
      return;
    }
    // 校验目标字数与每日目标为正数
    if (form.targetWords <= 0) {
      setError('目标字数需为正数');
      return;
    }
    if (form.dailyGoal <= 0) {
      setError('每日目标需为正数');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        synopsis: form.synopsis.trim(),
        genre: form.genre,
        targetWords: form.targetWords,
        coverColor: form.coverColor,
        dailyGoal: form.dailyGoal,
      };
      // book 存在则更新，否则新建
      const saved = book
        ? await bookRepository.update(book.id, payload)
        : await bookRepository.create(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  /** 创建作品并立即 AI 生成 6 大分类世界观 */
  const handleCreateWithWorldview = async (): Promise<void> => {
    if (!form.title.trim()) {
      setError('请填写作品名称');
      return;
    }
    if (!form.synopsis.trim()) {
      setError('请填写作品简介，AI 需要简介才能生成世界观');
      return;
    }
    if (form.targetWords <= 0 || form.dailyGoal <= 0) {
      setError('目标字数与每日目标需为正数');
      return;
    }

    setGeneratingWorld(true);
    setError(null);
    let saved: Book | null = null;
    try {
      // 1. 先创建作品
      saved = await bookRepository.create({
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        synopsis: form.synopsis.trim(),
        genre: form.genre,
        targetWords: form.targetWords,
        coverColor: form.coverColor,
        dailyGoal: form.dailyGoal,
      });
      // 2. 调用 AI 批量生成世界观（直接写入 db.worldview）
      await executeWorldviewBatch(
        saved.id,
        saved.title,
        saved.synopsis,
        saved.genre,
      );
      pushToast('success', '作品已创建，世界观已生成');
      onSaved(saved);
      onClose();
    } catch (err) {
      // AI 生成失败时回滚：删除刚创建的空作品，避免重复创建
      if (saved) {
        try {
          await bookRepository.delete(saved.id);
        } catch (rollbackErr) {
          pushToast(
            'error',
            `回滚空作品失败：${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`,
          );
        }
      }
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGeneratingWorld(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={book ? '编辑作品' : '新建作品'}
      width="520px"
    >
      <div className="flex flex-col gap-4">
        {/* AI 模型未配置提示（仅新建模式） */}
        {modelUnconfigured && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/8 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-serif text-sm font-medium text-foreground">
                尚未配置 AI 大模型
              </p>
              <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                Scribe 的续写、大纲、世界观生成等 AI 功能依赖大模型。你仍可先创建作品，稍后再配置模型。
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/settings');
              }}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md border border-primary/40 bg-background px-3 py-1.5',
                'font-sans text-xs text-primary transition-all',
                'hover:bg-primary/10 hover:shadow-soft',
              )}
            >
              <Settings className="h-3 w-3" aria-hidden="true" />
              前往设置
            </button>
          </div>
        )}

        {/* 书名 */}
        <Input
          label="作品名称"
          name="title"
          value={form.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="如：云隐录"
          maxLength={60}
          required
        />

        {/* 副标题 */}
        <Input
          label="副标题"
          name="subtitle"
          value={form.subtitle}
          onChange={(e) => updateField('subtitle', e.target.value)}
          placeholder="如：一剑光寒十九州"
          maxLength={60}
        />

        {/* 简介 */}
        <Textarea
          label="作品简介"
          name="synopsis"
          value={form.synopsis}
          onChange={(e) => updateField('synopsis', e.target.value)}
          placeholder="简述故事梗概、主要矛盾与基调…"
          rows={3}
          maxLength={500}
        />

        {/* 类型 + 目标字数 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <label className="mb-1.5 block font-serif text-sm text-foreground">
              类型
            </label>
            <select
              value={form.genre}
              onChange={(e) => updateField('genre', e.target.value)}
              className={cn(
                'w-full rounded border border-border bg-muted px-3 py-2',
                'font-serif text-sm text-foreground',
                'transition-all duration-200',
                'focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/25',
              )}
            >
              {GENRE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="目标字数"
            name="targetWords"
            type="number"
            min={1}
            step={10000}
            value={form.targetWords}
            onChange={(e) =>
              updateField('targetWords', Number(e.target.value) || 0)
            }
          />
        </div>

        {/* 每日目标 */}
        <Input
          label="每日字数目标"
          name="dailyGoal"
          type="number"
          min={1}
          step={500}
          value={form.dailyGoal}
          onChange={(e) =>
            updateField('dailyGoal', Number(e.target.value) || 0)
          }
        />

        {/* 封面色选择器 */}
        <div className="flex flex-col">
          <label className="mb-1.5 block font-serif text-sm text-foreground">
            封面色
          </label>
          <div className="flex items-center gap-2.5">
            {COVER_PRESETS.map((color) => {
              const selected = form.coverColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => updateField('coverColor', color)}
                  title={color}
                  aria-label={`选择封面色 ${color}`}
                  aria-pressed={selected}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-all duration-200',
                    selected
                      ? 'scale-110 border-foreground shadow-soft'
                      : 'border-border hover:scale-105 hover:border-secondary',
                  )}
                  style={{ backgroundColor: color }}
                />
              );
            })}
            {/* 当前色值预览 */}
            <span className="ml-1 font-mono text-[11px] text-muted-foreground">
              {form.coverColor}
            </span>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <p className="rounded border border-primary/40 bg-primary/8 px-3 py-2 text-xs text-primary">
            {error}
          </p>
        )}

        {/* 操作区 */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" size="md" onClick={onClose} disabled={submitting || generatingWorld}>
            取消
          </Button>
          {/* 新建模式下额外提供"创建并 AI 生成世界观"按钮 */}
          {!book && (
            <button
              type="button"
              onClick={handleCreateWithWorldview}
              disabled={submitting || generatingWorld || modelUnconfigured}
              className={cn(
                'flex items-center gap-1.5 rounded border border-secondary/40 bg-secondary/5 px-3 py-2',
                'font-serif text-sm text-secondary transition-all',
                'hover:bg-secondary/10 hover:shadow-soft',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
              title={modelUnconfigured ? '请先配置 AI 大模型' : '创建作品并调用 AI 自动生成 6 大分类世界观'}
            >
              {generatingWorld ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {generatingWorld ? '生成中…' : '创建并生成世界观'}
            </button>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            loading={submitting}
            disabled={generatingWorld}
          >
            {book ? '保存修改' : '创建作品'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default BookForm;
