/**
 * AI 大模型配置 Store
 *
 * 以服务端（/api/models）为唯一真实来源，不使用任何本地兜底。
 * 服务端不可达或未配置时，直接暴露错误状态给用户。
 */
import { create } from 'zustand';
import type { AIModel, ModelProvider, ModelCapability, ProviderMeta } from '../types';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';

const API_BASE = '/api/models';

/** 服务商元信息表 */
export const PROVIDER_META: Record<ModelProvider, ProviderMeta> = {
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    color: '#10a37f',
    officialModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  anthropic: {
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    color: '#d97757',
    officialModels: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  },
  deepseek: {
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    color: '#4f46e5',
    officialModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  qwen: {
    label: '通义千问',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    color: '#6366f1',
    officialModels: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'],
  },
  doubao: {
    label: '豆包',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    color: '#0ea5e9',
    officialModels: ['doubao-pro-32k', 'doubao-lite-32k', 'doubao-1-5-pro-256k'],
  },
  glm: {
    label: '智谱 GLM',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    color: '#14b8a6',
    officialModels: ['glm-4-plus', 'glm-4-air', 'glm-4-long', 'glm-4-flash'],
  },
  moonshot: {
    label: '月之暗面',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    color: '#f43f5e',
    officialModels: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'],
  },
  custom: {
    label: '自定义',
    defaultBaseUrl: 'http://localhost:11434/v1',
    color: '#78716c',
    officialModels: [],
  },
};

/** 能力标签中文名 */
export const CAPABILITY_LABELS: Record<ModelCapability, string> = {
  continue: '续写',
  rewrite: '改写',
  polish: '润色',
  expand: '扩写',
  outline: '大纲生成',
  fulltext: '全文生成',
  dialogue: '角色对话',
  worldview: '世界观构建',
};

/** 默认全部能力 */
const ALL_CAPABILITIES: ModelCapability[] = [
  'continue', 'rewrite', 'polish', 'expand',
  'outline', 'fulltext', 'dialogue', 'worldview',
];

/** 给服务端返回的模型补全前端需要的字段 */
function normalizeModel(raw: Record<string, unknown>): AIModel {
  return {
    id: String(raw.id),
    name: String(raw.name),
    provider: (raw.provider as ModelProvider) ?? 'custom',
    modelId: String(raw.modelId),
    type: 'chat',
    capabilities: Array.isArray(raw.capabilities)
      ? (raw.capabilities as ModelCapability[])
      : ALL_CAPABILITIES,
    apiKey: String(raw.apiKey ?? ''),
    baseUrl: String(raw.baseUrl),
    temperature: Number(raw.temperature ?? 0.7),
    maxTokens: Number(raw.maxTokens ?? 4096),
    enabled: Boolean(raw.enabled),
    isDefault: Boolean(raw.isDefault),
    sortOrder: Number(raw.sortOrder ?? 0),
    createdAt: Number(raw.createdAt ?? Date.now()),
    updatedAt: Number(raw.updatedAt ?? Date.now()),
  };
}

export interface AIModelStore {
  models: AIModel[];
  activeModelId: string | null;
  loading: boolean;
  /** 服务端通信错误信息，null 表示无错误 */
  error: string | null;
  /** 从服务端拉取模型列表（初始化调用一次） */
  fetchModels: () => Promise<void>;
  /** 获取当前激活（且启用）的模型；无则返回 null */
  getActiveModel: () => AIModel | null;
  /** 获取默认模型；无则返回 null */
  getDefaultModel: () => AIModel | null;
  /** 获取启用中的模型列表（按 sortOrder 排序） */
  getEnabledModels: () => AIModel[];
  /** 切换当前激活模型 */
  setActiveModel: (id: string) => void;
  /** 添加新模型（同步到服务端） */
  addModel: (model: Omit<AIModel, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>) => Promise<void>;
  /** 更新模型（同步到服务端） */
  updateModel: (id: string, patch: Partial<AIModel>) => Promise<void>;
  /** 删除模型（同步到服务端） */
  deleteModel: (id: string) => Promise<void>;
  /** 切换模型启用状态 */
  toggleEnabled: (id: string) => Promise<void>;
  /** 设为默认模型 */
  setDefault: (id: string) => Promise<void>;
  /** 测试模型连通性（走服务端） */
  testModel: (id: string) => Promise<{ ok: boolean; message: string }>;
}

export const useAIModelStore = create<AIModelStore>((set, get) => ({
  models: [],
  activeModelId: null,
  loading: false,
  error: null,

  fetchModels: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiGet<{ models: Record<string, unknown>[]; activeModelId: string | null }>(API_BASE);
      const models = data.models.map(normalizeModel);
      const activeId = data.activeModelId ?? null;
      set({ models, activeModelId: activeId, loading: false, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '无法连接服务端，请检查后端服务是否运行';
      set({ models: [], activeModelId: null, loading: false, error: msg });
    }
  },

  getActiveModel: () => {
    const { models, activeModelId, getDefaultModel } = get();
    if (activeModelId) {
      const m = models.find((m) => m.id === activeModelId && m.enabled);
      if (m) return m;
    }
    return getDefaultModel();
  },

  getDefaultModel: () => {
    const { models } = get();
    const def = models.find((m) => m.isDefault && m.enabled);
    if (def) return def;
    const first = models
      .filter((m) => m.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0];
    return first ?? null;
  },

  getEnabledModels: () => {
    return [...get().models]
      .filter((m) => m.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  setActiveModel: (id: string) => {
    set({ activeModelId: id });
  },

  addModel: async (model) => {
    const body: Record<string, unknown> = {
      name: model.name,
      provider: model.provider,
      modelId: model.modelId,
      apiKey: model.apiKey,
      baseUrl: model.baseUrl,
      enabled: model.enabled,
      isDefault: model.isDefault,
      temperature: model.temperature,
      maxTokens: model.maxTokens,
      capabilities: model.capabilities?.length ? model.capabilities : ALL_CAPABILITIES,
    };
    const created = normalizeModel(await apiPost<Record<string, unknown>>(API_BASE, body));
    const next = [
      ...get().models.map((m) => (created.isDefault ? { ...m, isDefault: false } : m)),
      created,
    ];
    set({ models: next });
    if (created.isDefault || next.length === 1) {
      get().setActiveModel(created.id);
    }
  },

  updateModel: async (id, patch) => {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.provider !== undefined) body.provider = patch.provider;
    if (patch.modelId !== undefined) body.modelId = patch.modelId;
    if (patch.apiKey !== undefined) body.apiKey = patch.apiKey;
    if (patch.baseUrl !== undefined) body.baseUrl = patch.baseUrl;
    if (patch.enabled !== undefined) body.enabled = patch.enabled;
    if (patch.isDefault !== undefined) body.isDefault = patch.isDefault;
    if (patch.temperature !== undefined) body.temperature = patch.temperature;
    if (patch.maxTokens !== undefined) body.maxTokens = patch.maxTokens;
    if (patch.capabilities !== undefined) body.capabilities = patch.capabilities;

    const updated = normalizeModel(await apiPut<Record<string, unknown>>(`${API_BASE}/${id}`, body));
    const next = get().models.map((m) => {
      if (m.id === id) return updated;
      if (updated.isDefault) return { ...m, isDefault: false };
      return m;
    });
    set({
      models: next,
      activeModelId: updated.isDefault ? updated.id : get().activeModelId,
    });
  },

  deleteModel: async (id) => {
    await apiDelete(`${API_BASE}/${id}`);
    await get().fetchModels();
  },

  toggleEnabled: async (id) => {
    const target = get().models.find((m) => m.id === id);
    if (!target) return;
    const enabledCount = get().models.filter((m) => m.enabled).length;
    if (target.enabled && target.isDefault && enabledCount <= 1) return;
    await get().updateModel(id, { enabled: !target.enabled });
    if (target.enabled && get().activeModelId === id) {
      const def = get().getDefaultModel();
      if (def) get().setActiveModel(def.id);
    }
  },

  setDefault: async (id) => {
    const target = get().models.find((m) => m.id === id);
    if (!target || !target.enabled) return;
    await apiPost(`${API_BASE}/${id}/activate`);
    const next = get().models.map((m) => ({ ...m, isDefault: m.id === id }));
    set({ models: next, activeModelId: id });
  },

  testModel: async (id) => {
    try {
      return await apiPost<{ ok: boolean; message: string }>(`${API_BASE}/${id}/test`);
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : '测试失败' };
    }
  },
}));
