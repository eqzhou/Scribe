/**
 * AIModelFormModal 添加/编辑模型弹窗
 *
 * 表单字段：
 *   - 服务商选择（网格）
 *   - 显示名称、模型 ID
 *   - API 基础地址、API Key（可显示/隐藏）
 *   - 温度、最大输出 Token
 *   - 能力标签（多选）
 *   - 启用开关
 *
 * 底部：测试连接 + 取消 + 保存（添加）
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { PROVIDER_META, CAPABILITY_LABELS } from '../../stores/aiModelStore';
import type { ModelProvider, ModelCapability } from '../../types';
import { Modal, Input, Button } from '../ui';
import { cn } from '../../utils/cn';
import { ALL_CAPABILITIES, type FormState } from './constants';

export interface AIModelFormModalProps {
  open: boolean;
  editingId: string | null;
  form: FormState;
  onFormChange: (form: FormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  onTestInModal: () => void;
  testing: boolean;
  testResult: { ok: boolean; message: string } | null;
}

export function AIModelFormModal({
  open,
  editingId,
  form,
  onFormChange,
  onClose,
  onSubmit,
  onTestInModal,
  testing,
  testResult,
}: AIModelFormModalProps) {
  const [showKey, setShowKey] = useState(false);

  // 每次打开弹窗时重置 API Key 显示状态，与原内联实现保持一致
  useEffect(() => {
    if (open) setShowKey(false);
  }, [open]);

  /** 切换服务商 */
  const changeProvider = (provider: ModelProvider) => {
    const meta = PROVIDER_META[provider];
    onFormChange({
      ...form,
      provider,
      baseUrl: meta.defaultBaseUrl,
      modelId: meta.officialModels[0] ?? form.modelId,
    });
  };

  /** 切换能力标签 */
  const toggleCapability = (cap: ModelCapability) => {
    onFormChange({
      ...form,
      capabilities: form.capabilities.includes(cap)
        ? form.capabilities.filter((c) => c !== cap)
        : [...form.capabilities, cap],
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? '编辑模型' : '添加模型'}
      width="560px"
    >
      <div className="space-y-4">
        {/* 服务商选择 */}
        <div>
          <label className="mb-1.5 block font-serif text-sm text-foreground">服务商</label>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(PROVIDER_META) as ModelProvider[]).map((p) => {
              const meta = PROVIDER_META[p];
              const selected = form.provider === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => changeProvider(p)}
                  className={cn(
                    'relative flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 transition-all',
                    selected
                      ? 'border-primary/60 bg-primary/8 ring-2 ring-primary/20'
                      : 'border-border bg-muted/30 hover:border-secondary hover:bg-muted',
                  )}
                >
                  <span
                    className="h-6 w-6 rounded-md text-white flex items-center justify-center font-bold text-[12px]"
                    style={{ backgroundColor: meta.color }}
                  >
                    {meta.label.slice(0, 1)}
                  </span>
                  <span className="text-[11px] text-foreground">{meta.label}</span>
                  {selected && (
                    <Check className="absolute top-1 right-1 h-3 w-3 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="显示名称"
            placeholder="如：GPT-4o 写作助手"
            value={form.name}
            onChange={(e) => onFormChange({ ...form, name: e.target.value })}
          />
          <Input
            label="模型 ID"
            placeholder="如：gpt-4o-mini"
            value={form.modelId}
            onChange={(e) => onFormChange({ ...form, modelId: e.target.value })}
          />
        </div>

        <Input
          label="API 基础地址"
          placeholder="https://api.openai.com/v1"
          value={form.baseUrl}
          onChange={(e) => onFormChange({ ...form, baseUrl: e.target.value })}
        />

        {/* API Key */}
        <div>
          <div className="flex items-center justify-between">
            <label className="mb-1.5 block font-serif text-sm text-foreground">
              API Key
              <span className="ml-1 text-[12px] text-muted-foreground">
                （本地模型可留空）
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
          <input
            type={showKey ? 'text' : 'password'}
            value={form.apiKey}
            onChange={(e) => onFormChange({ ...form, apiKey: e.target.value })}
            placeholder="sk-..."
            className={cn(
              'w-full rounded bg-muted px-3 py-2 font-mono text-sm text-foreground',
              'border border-border transition-all duration-200',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/25',
            )}
          />
        </div>

        {/* 温度 + 最大 token */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="font-serif text-sm text-foreground">温度</label>
              <span className="font-mono text-xs text-muted-foreground">{form.temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={form.temperature}
              onChange={(e) => onFormChange({ ...form, temperature: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>
          <Input
            label="最大输出 Token（0 为不限）"
            type="number"
            min="0"
            value={form.maxTokens || ''}
            onChange={(e) => onFormChange({ ...form, maxTokens: Number(e.target.value) || 0 })}
            placeholder="0"
          />
        </div>

        {/* 能力标签 */}
        <div>
          <label className="mb-1.5 block font-serif text-sm text-foreground">支持能力</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CAPABILITIES.map((cap) => {
              const checked = form.capabilities.includes(cap);
              return (
                <button
                  key={cap}
                  type="button"
                  onClick={() => toggleCapability(cap)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-all',
                    checked
                      ? 'border-secondary bg-secondary/10 text-secondary'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-secondary/50 hover:text-foreground',
                  )}
                >
                  {CAPABILITY_LABELS[cap]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 启用开关 */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex flex-col">
            <span className="font-serif text-sm text-foreground">启用该模型</span>
            <span className="text-[12px] text-muted-foreground">
              停用后不会出现在切换列表中
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.enabled}
            onClick={() => onFormChange({ ...form, enabled: !form.enabled })}
            className={cn(
              'relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors duration-200',
              form.enabled ? 'bg-primary' : 'bg-border',
            )}
          >
            <span
              className={cn(
                'absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                form.enabled ? 'translate-x-5' : 'translate-x-0',
              )}
            />
          </button>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className={cn('h-3.5 w-3.5', testing && 'animate-spin')} />}
            onClick={onTestInModal}
            disabled={!form.modelId || !form.baseUrl || testing}
          >
            {testing ? '测试中...' : '测试连接'}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onSubmit}
              disabled={!form.name.trim() || !form.modelId.trim()}
            >
              {editingId ? '保存' : '添加'}
            </Button>
          </div>
        </div>

        {/* 弹窗内测试结果 */}
        <AnimatePresence>
          {testResult && !testing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                'overflow-hidden rounded-lg border px-3 py-2 text-xs',
                testResult.ok
                  ? 'border-moss/30 bg-moss/10 text-moss'
                  : 'border-primary/30 bg-primary/10 text-primary',
              )}
            >
              {testResult.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}

export default AIModelFormModal;
