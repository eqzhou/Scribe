/**
 * AIModelManager 大模型管理
 *
 * 设置页中的大模型配置区块：
 *   - 模型列表（卡片形式，含启用/停用、默认、编辑、删除、测试）
 *   - 添加/编辑弹窗（服务商、模型 ID、显示名、API Key、Base URL、温度、能力标签）
 *   - 当前激活模型切换
 *
 * 数据存储：aiModelStore（服务端持久化，无本地兜底）
 *
 * 卡片与表单弹窗已拆分至 ModelCard / AIModelFormModal；常量与表单默认值见 ./constants。
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, Sparkles, AlertCircle, Loader2, Star } from 'lucide-react';
import { useAIModelStore, PROVIDER_META } from '../../stores/aiModelStore';
import { useToastStore } from '../../stores';
import type { AIModel } from '../../types';
import { Button, ConfirmDialog } from '../ui';
import { cn } from '../../utils/cn';
import { defaultFormState, type FormState } from './constants';
import { ModelCard } from './ModelCard';
import { AIModelFormModal } from './AIModelFormModal';

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
  const [form, setForm] = useState<FormState>(defaultFormState());
  const [providerOpen, setProviderOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const pushToast = useToastStore.getState().pushToast;

  // 资源清理：保存测试用的 timer 与 AbortController，组件卸载时一并清理
  const testTimerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      if (testTimerRef.current !== null) window.clearTimeout(testTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const enabledModels = getEnabledModels();
  const active = getActiveModel();

  /** 打开添加弹窗 */
  const openAdd = () => {
    setEditingId(null);
    setForm(defaultFormState());
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
      pushToast('error', err instanceof Error ? err.message : '保存失败');
    }
  };

  /** 测试连通性 */
  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    const result = await testModel(id);
    setTestResult(result);
    setTestingId(null);
    if (testTimerRef.current !== null) window.clearTimeout(testTimerRef.current);
    testTimerRef.current = window.setTimeout(() => setTestResult(null), 4000);
  };

  /** 切换启用状态 */
  const handleToggleEnabled = async (id: string) => {
    try {
      await toggleEnabled(id);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : '操作失败');
    }
  };

  /** 设为默认 */
  const handleSetDefault = async (id: string) => {
    try {
      await setDefault(id);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : '操作失败');
    }
  };

  /** 删除模型 */
  const handleDelete = async (id: string) => {
    try {
      await deleteModel(id);
      setDeleteConfirmId(null);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : '删除失败');
    }
  };

  /** 弹窗内测试连接 */
  const handleTestInModal = async () => {
    if (!form.modelId || !form.baseUrl) return;
    if (testingId === '__modal__') return;
    setTestingId('__modal__');
    setTestResult(null);
    // 复用组件级 AbortController，组件卸载时会自动 abort
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
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
    if (testTimerRef.current !== null) window.clearTimeout(testTimerRef.current);
    testTimerRef.current = window.setTimeout(() => setTestResult(null), 4000);
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
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          支持所有 <span className="font-mono text-foreground">OpenAI 兼容接口</span> 的模型服务，
          包括云端 API（OpenAI、Anthropic、DeepSeek、通义、豆包、智谱、月之暗面等）
          以及本地部署（Ollama、vLLM、LM Studio、llama.cpp 等）。
        </p>
      </div>

      {/* 服务端连接错误提示 */}
      {error && !loading && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
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
            <ModelCard
              key={model.id}
              model={model}
              isActive={activeModelId === model.id}
              testingId={testingId}
              testResult={testResult}
              onTest={handleTest}
              onToggleEnabled={handleToggleEnabled}
              onSetDefault={handleSetDefault}
              onEdit={openEdit}
              onDelete={(id) => setDeleteConfirmId(id)}
            />
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
      <AIModelFormModal
        open={modalOpen}
        editingId={editingId}
        form={form}
        onFormChange={setForm}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        onTestInModal={handleTestInModal}
        testing={testingId === '__modal__'}
        testResult={testResult}
      />

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
