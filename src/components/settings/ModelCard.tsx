/**
 * ModelCard 模型卡片
 *
 * 在大模型管理列表中展示单个模型：
 *   - 服务商色块、名称、模型 ID、能力标签
 *   - 操作按钮：测试 / 启用-停用 / 设为默认 / 编辑 / 删除
 *   - 测试进行中的加载提示条
 */
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Trash2, Star, Power, RefreshCw } from 'lucide-react';
import { PROVIDER_META, CAPABILITY_LABELS } from '../../stores/aiModelStore';
import type { AIModel } from '../../types';
import { cn } from '../../utils/cn';

export interface ModelCardProps {
  model: AIModel;
  isActive: boolean;
  testingId: string | null;
  testResult: { ok: boolean; message: string } | null;
  onTest: (id: string) => void;
  onToggleEnabled: (id: string) => void;
  onSetDefault: (id: string) => void;
  onEdit: (model: AIModel) => void;
  onDelete: (id: string) => void;
}

export function ModelCard({
  model,
  isActive,
  testingId,
  onTest,
  onToggleEnabled,
  onSetDefault,
  onEdit,
  onDelete,
}: ModelCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group rounded-lg border bg-card transition-all duration-200',
        model.enabled ? 'border-border' : 'border-border/50 opacity-60',
        isActive && 'ring-2 ring-primary/30 border-primary/40',
      )}
    >
      <div className="flex items-center gap-4 px-4 py-3">
        {/* 服务商色块 */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white font-bold text-xs"
          style={{ backgroundColor: PROVIDER_META[model.provider].color }}
        >
          {PROVIDER_META[model.provider].label.slice(0, 2)}
        </div>

        {/* 模型信息 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-serif text-sm font-semibold text-foreground">
              {model.name}
            </span>
            {model.isDefault && (
              <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[12px] font-medium text-warning">
                默认
              </span>
            )}
            {isActive && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[12px] font-medium text-primary">
                正在使用
              </span>
            )}
            {!model.enabled && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground">
                已停用
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{PROVIDER_META[model.provider].label}</span>
            <span className="opacity-50">·</span>
            <span className="truncate font-mono">{model.modelId}</span>
          </div>
          {/* 能力标签 */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {model.capabilities.slice(0, 4).map((c) => (
              <span
                key={c}
                className="rounded bg-secondary/10 px-1.5 py-0.5 text-[12px] text-secondary"
              >
                {CAPABILITY_LABELS[c]}
              </span>
            ))}
            {model.capabilities.length > 4 && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground">
                +{model.capabilities.length - 4}
              </span>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onTest(model.id)}
            disabled={testingId === model.id}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="测试连通性"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', testingId === model.id && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={() => onToggleEnabled(model.id)}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              model.enabled
                ? 'text-moss hover:bg-moss/10 hover:text-moss'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            title={model.enabled ? '停用' : '启用'}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSetDefault(model.id)}
            disabled={model.isDefault || !model.enabled}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              model.isDefault
                ? 'text-warning'
                : model.enabled
                  ? 'text-muted-foreground hover:bg-muted hover:text-warning'
                  : 'text-muted-foreground cursor-not-allowed',
            )}
            title="设为默认"
          >
            <Star className="h-3.5 w-3.5" fill={model.isDefault ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(model)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="编辑"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(model.id)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 测试结果提示条 */}
      <AnimatePresence>
        {testingId === model.id && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/50 bg-muted/30 px-4 py-2"
          >
            <span className="text-xs text-muted-foreground">正在测试连接...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ModelCard;
