/**
 * AIModelManager 大模型管理
 *
 * 设置页中的大模型配置区块：
 *   - 模型列表（卡片形式，含启用/停用、默认、编辑、删除、测试）
 *   - 添加/编辑弹窗（服务商、模型 ID、显示名、API Key、Base URL、温度、能力标签）
 *   - 当前激活模型切换
 *
 * 数据存储：aiModelStore（服务端持久化，无本地兜底）
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit2,
  Trash2,
  Star,
  Power,
  RefreshCw,
  ChevronDown,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  useAIModelStore,
  PROVIDER_META,
  CAPABILITY_LABELS,
} from '../../stores/aiModelStore';
import type { AIModel, ModelProvider, ModelCapability } from '../../types';
import { Modal, Input, Button, ConfirmDialog } from '../ui';
import { cn } from '../../utils/cn';

const ALL_CAPABILITIES: ModelCapability[] = [
  'continue', 'rewrite', 'polish', 'expand',
  'outline', 'fulltext', 'dialogue', 'worldview',
];

/** 模型表单默认值 */
function defaultFormState(provider: ModelProvider = 'openai'): Omit<AIModel, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'> {
  const meta = PROVIDER_META[provider];
  return {
    name: '',
    provider,
    modelId: meta.officialModels[0] ?? '',
    type: 'chat',
    capabilities: [...ALL_CAPABILITIES],
    apiKey: '',
    baseUrl: meta.defaultBaseUrl,
    temperature: 0.7,
    maxTokens: 0,
    enabled: true,
    isDefault: false,
  };
}

export function AIModelManager() {
  const { models, activeModelId, loading, error, getEnabledModels, getActiveModel, fetchModels } = useAIModelStore();
  const addModel = useAIModelStore((s) => s.addModel);
  const updateModel = useAIModelStore((s) => s.updateModel);
  const deleteModel = useAIModelStore((s) => s.deleteModel);
  const toggleEnabled = useAIModelStore((s) => s.toggleEnabled);
  const setDefault = useAIModelStore((s) => s.setDefault);
  const setActiveModel = useAIModelStore((s) => s.setActiveModel);
  const testModel = useAIModelStore((s) => s.testModel);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultFormState());
  const [showKey, setShowKey] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const enabledModels = getEnabledModels();
  const active = getActiveModel();

  /** 打开添加弹窗 */
  const openAdd = () => {
    setEditingId(null);
    setForm(defaultFormState());
    setShowKey(false);
    setTestResult(null);
    setModalOpen(true);
  };

  /** 打开编辑弹窗 */
  const openEdit = (model: AIModel) => {
    setEditingId(model.id);
    setForm({
      name: model.name,
      provider: model.provider,
      modelId: model.modelId,
      type: model.type,
      capabilities: [...model.capabilities],
      apiKey: model.apiKey,
      baseUrl: model.baseUrl,
      temperature: model.temperature,
      maxTokens: model.maxTokens,
      enabled: model.enabled,
      isDefault: model.isDefault,
    });
    setShowKey(false);
    setTestResult(null);
    setModalOpen(true);
  };

  /** 提交表单 */
  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    if (!form.modelId.trim()) return;

    try {
      if (editingId) {
        await updateModel(editingId, form);
      } else {
        await addModel(form);
      }
      setModalOpen(false);
    } catch (err) {
      console.error('保存模型失败:', err);
      alert(err instanceof Error ? err.message : '保存失败');
    }
  };

  /** 切换服务商 */
  const changeProvider = (provider: ModelProvider) => {
    const meta = PROVIDER_META[provider];
    setForm((f) => ({
      ...f,
      provider,
      baseUrl: meta.defaultBaseUrl,
      modelId: meta.officialModels[0] ?? f.modelId,
    }));
    setProviderOpen(false);
  };

  /** 切换能力标签 */
  const toggleCapability = (cap: ModelCapability) => {
    setForm((f) => ({
      ...f,
      capabilities: f.capabilities.includes(cap)
        ? f.capabilities.filter((c) => c !== cap)
        : [...f.capabilities, cap],
    }));
  };

  /** 测试连通性 */
  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    const result = await testModel(id);
    setTestResult(result);
    setTestingId(null);
    setTimeout(() => setTestResult(null), 4000);
  };

  /** 切换启用状态 */
  const handleToggleEnabled = async (id: string) => {
    try {
      await toggleEnabled(id);
    } catch (err) {
      console.error('切换启用状态失败:', err);
      alert(err instanceof Error ? err.message : '操作失败');
    }
  };

  /** 设为默认 */
  const handleSetDefault = async (id: string) => {
    try {
      await setDefault(id);
    } catch (err) {
      console.error('设为默认失败:', err);
      alert(err instanceof Error ? err.message : '操作失败');
    }
  };

  /** 删除模型 */
  const handleDelete = async (id: string) => {
    try {
      await deleteModel(id);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('删除模型失败:', err);
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };
  const handleTestInModal = async () => {
    if (!form.modelId || !form.baseUrl) return;
    if (testingId === '__modal__') return;
    setTestingId('__modal__');
    setTestResult(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelConfig: {
            model: form.modelId,
            apiKey: form.apiKey,
            baseUrl: form.baseUrl,
          },
        }),
        signal: controller.signal,
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      setTestResult(data);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setTestResult({ ok: false, message: '连接超时（20 秒无响应）' });
      } else {
        setTestResult({ ok: false, message: `网络错误: ${e instanceof Error ? e.message : String(e)}` });
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
    setTestingId(null);
    setTimeout(() => setTestResult(null), 4000);
  };

  const sortedModels = [...models].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });

  return (
    <div className="space-y-4">
      {/* 顶部：当前使用模型 + 添加按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-serif text-sm font-semibold text-foreground">
            当前使用
          </span>
          {active ? (
            <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: PROVIDER_META[active.provider].color }}
              />
              <span className="font-serif text-sm text-foreground">{active.name}</span>
              <span className="text-xs text-muted-foreground">
                · {active.modelId}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">尚未配置模型</span>
          )}
          {enabledModels.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProviderOpen((v) => !v)}
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-all hover:border-secondary hover:text-foreground"
              >
                切换
                <ChevronDown className={cn('h-3 w-3 transition-transform', providerOpen && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {providerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-border bg-background/95 p-1 shadow-lifted backdrop-blur-md"
                  >
                    {enabledModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setActiveModel(m.id);
                          setProviderOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                          activeModelId === m.id
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: PROVIDER_META[m.provider].color }}
                        />
                        {m.name}
                        {m.isDefault && (
                          <Star className="ml-auto h-3 w-3 text-warning" fill="currentColor" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        <Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={openAdd}>
          添加模型
        </Button>
      </div>

      {/* 说明条 */}
      <div className="flex items-start gap-2 rounded-lg border border-secondary/30 bg-secondary/5 px-3 py-2">
        <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-secondary" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          支持所有 <span className="font-mono text-foreground">OpenAI 兼容接口</span> 的模型服务，
          包括云端 API（OpenAI、Anthropic、DeepSeek、通义、豆包、智谱、月之暗面等）
          以及本地部署（Ollama、vLLM、LM Studio、llama.cpp 等）。
        </p>
      </div>

      {/* 服务端连接错误提示 */}
      {error && !loading && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-xs font-medium text-destructive">{error}</p>
            <button
              type="button"
              onClick={() => fetchModels()}
              className="mt-1 text-xs text-muted-foreground underline hover:text-foreground"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">加载模型配置中...</span>
        </div>
      )}

      {/* 模型列表 */}
      <div className="space-y-2">
        {!loading && sortedModels.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-serif text-sm text-foreground">尚未添加大模型</p>
            <p className="mt-1 text-xs text-muted-foreground">
              点击右上角「添加模型」配置你的第一个 AI 模型
            </p>
          </div>
        ) : (
          sortedModels.map((model) => (
            <motion.div
              key={model.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'group rounded-lg border bg-card transition-all duration-200',
                model.enabled ? 'border-border' : 'border-border/50 opacity-60',
                activeModelId === model.id && 'ring-2 ring-primary/30 border-primary/40',
              )}
            >
              <div className="flex items-center gap-4 px-4 py-3">
                {/* 服务商色块 */}
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-white font-bold text-xs"
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
                    {activeModelId === model.id && (
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
                    onClick={() => handleTest(model.id)}
                    disabled={testingId === model.id}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="测试连通性"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', testingId === model.id && 'animate-spin')} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleEnabled(model.id)}
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
                    onClick={() => handleSetDefault(model.id)}
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
                    onClick={() => openEdit(model)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="编辑"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(model.id)}
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
          ))
        )}
      </div>

      {/* 全局测试结果 toast（简化：顶部显示） */}
      <AnimatePresence>
        {testResult && testingId === null && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cn(
              'rounded-lg border px-3 py-2 text-xs',
              testResult.ok
                ? 'border-moss/30 bg-moss/10 text-moss'
                : 'border-primary/30 bg-primary/10 text-primary',
            )}
          >
            {testResult.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 添加/编辑弹窗 */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
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
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="模型 ID"
              placeholder="如：gpt-4o-mini"
              value={form.modelId}
              onChange={(e) => setForm({ ...form, modelId: e.target.value })}
            />
          </div>

          <Input
            label="API 基础地址"
            placeholder="https://api.openai.com/v1"
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
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
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
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
                onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>
            <Input
              label="最大输出 Token（0 为不限）"
              type="number"
              min="0"
              value={form.maxTokens || ''}
              onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) || 0 })}
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
              onClick={() => setForm({ ...form, enabled: !form.enabled })}
              className={cn(
                'relative h-6 w-11 flex-shrink-0 overflow-hidden rounded-full transition-colors duration-200',
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
              icon={<RefreshCw className={cn('h-3.5 w-3.5', testingId === '__modal__' && 'animate-spin')} />}
              onClick={handleTestInModal}
              disabled={!form.modelId || !form.baseUrl || testingId === '__modal__'}
            >
              {testingId === '__modal__' ? '测试中...' : '测试连接'}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                取消
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={!form.name.trim() || !form.modelId.trim()}
              >
                {editingId ? '保存' : '添加'}
              </Button>
            </div>
          </div>

          {/* 弹窗内测试结果 */}
          <AnimatePresence>
            {testResult && testingId !== '__modal__' && (
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

      {/* 删除确认 */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) handleDelete(deleteConfirmId);
        }}
        title="删除模型"
        message="确认删除该模型配置？此操作不可撤销。"
        confirmText="删除"
        danger
      />
    </div>
  );
}

export default AIModelManager;
