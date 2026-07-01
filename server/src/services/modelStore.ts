/**
 * 模型配置服务
 *
 * JSON 文件持久化（server/data/models.json）。
 * 支持多模型 CRUD、激活/停用、默认模型切换。
 * 与前端 aiModelStore 的数据结构对齐（AIModel 类型）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export interface ServerAIModel {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  isDefault: boolean;
  temperature: number;
  maxTokens: number;
  capabilities: string[];
  createdAt: number;
  updatedAt: number;
}

interface StoreData {
  models: ServerAIModel[];
  activeModelId: string | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'models.json');

let cache: StoreData | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load(): StoreData {
  if (cache) return cache;
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    cache = { models: [], activeModelId: null };
    return cache;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    cache = JSON.parse(raw) as StoreData;
  } catch {
    cache = { models: [], activeModelId: null };
  }
  return cache!;
}

function save(): void {
  if (!cache) return;
  ensureDir();
  // 防抖写入,避免频繁 IO
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    writeTimer = null;
  }, 100);
}

/** 列出所有模型(不返回 apiKey,避免泄露) */
export function listModels(includeKey = false): ServerAIModel[] {
  const data = load();
  return data.models.map((m) => {
    if (includeKey) return { ...m };
    const { apiKey, ...rest } = m;
    return { ...rest, apiKey: apiKey ? apiKey.slice(0, 6) + '***' : '' } as ServerAIModel;
  });
}

/** 获取激活的默认模型(返回完整 key,供 AI 服务内部使用) */
export function getActiveModel(): ServerAIModel | null {
  const data = load();
  if (!data.activeModelId) return null;
  const m = data.models.find((x) => x.id === data.activeModelId && x.enabled);
  return m ?? null;
}

export function getActiveModelId(): string | null {
  return load().activeModelId;
}

export function getModel(id: string, includeKey = false): ServerAIModel | null {
  const data = load();
  const m = data.models.find((x) => x.id === id);
  if (!m) return null;
  if (includeKey) return { ...m };
  const { apiKey, ...rest } = m;
  return { ...rest, apiKey: apiKey ? apiKey.slice(0, 6) + '***' : '' } as ServerAIModel;
}

export function createModel(input: Omit<ServerAIModel, 'id' | 'createdAt' | 'updatedAt'>): ServerAIModel {
  const data = load();
  const now = Date.now();
  const model: ServerAIModel = {
    ...input,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  // 第一个模型自动设为默认
  if (data.models.length === 0) {
    model.isDefault = true;
    data.activeModelId = model.id;
  }
  // 如果设为默认，清空其他模型的默认标记
  if (model.isDefault) {
    data.models.forEach((m) => { m.isDefault = false; });
    data.activeModelId = model.id;
  }
  data.models.push(model);
  save();
  const { apiKey, ...rest } = model;
  return { ...rest, apiKey: apiKey ? apiKey.slice(0, 6) + '***' : '' } as ServerAIModel;
}

export function updateModel(id: string, patch: Partial<ServerAIModel>): ServerAIModel | null {
  const data = load();
  const idx = data.models.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  const now = Date.now();
  const updated: ServerAIModel = { ...data.models[idx], ...patch, id, updatedAt: now };
  // 如果设为默认
  if (patch.isDefault) {
    data.models.forEach((m, i) => {
      if (i !== idx) m.isDefault = false;
    });
    data.activeModelId = id;
  }
  // 如果取消启用且是激活模型
  if (patch.enabled === false && data.activeModelId === id) {
    data.activeModelId = data.models.find((m) => m.id !== id && m.enabled)?.id ?? null;
  }
  data.models[idx] = updated;
  save();
  const { apiKey, ...rest } = updated;
  return { ...rest, apiKey: apiKey ? apiKey.slice(0, 6) + '***' : '' } as ServerAIModel;
}

export function deleteModel(id: string): boolean {
  const data = load();
  const idx = data.models.findIndex((m) => m.id === id);
  if (idx < 0) return false;
  const wasActive = data.activeModelId === id;
  data.models.splice(idx, 1);
  if (wasActive) {
    data.activeModelId = data.models.find((m) => m.enabled)?.id ?? null;
    if (data.activeModelId) {
      const m = data.models.find((x) => x.id === data.activeModelId);
      if (m) m.isDefault = true;
    }
  }
  save();
  return true;
}

export function setActiveModel(id: string): boolean {
  const data = load();
  const m = data.models.find((x) => x.id === id);
  if (!m || !m.enabled) return false;
  data.models.forEach((x) => { x.isDefault = false; });
  m.isDefault = true;
  data.activeModelId = id;
  save();
  return true;
}

/** 测试连通性 — 直接复用 aiService.ts 里的逻辑，但此处独立实现避免循环依赖 */
export async function testModel(id: string): Promise<{ ok: boolean; message: string }> {
  const m = getModel(id, true);
  if (!m) return { ok: false, message: '模型不存在' };
  if (!m.modelId || !m.baseUrl) return { ok: false, message: '缺少模型 ID 或 API 地址' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(`${m.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(m.apiKey ? { Authorization: `Bearer ${m.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: m.modelId,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (r.ok) return { ok: true, message: '连接成功' };
    const text = await r.text().catch(() => '');
    return { ok: false, message: `连接失败 (${r.status}): ${text.slice(0, 120)}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, message: '连接超时' };
    }
    return { ok: false, message: `网络错误: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}
