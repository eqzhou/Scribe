/**
 * 模型配置服务（按用户隔离）
 *
 * 持久化于 PostgreSQL（Prisma AIModel 表），所有数据绑定 userId。
 * 支持多模型 CRUD、激活/停用、默认模型切换。
 * 与前端 aiModelStore 的数据结构对齐（AIModel 类型）。
 *
 * 重要约束：
 *   - 所有读写操作必须显式传入 userId，禁止跨用户访问
 *   - 「默认模型」语义为「该用户的默认模型」，每用户独立
 *   - 返回给前端时 apiKey 必须掩码，仅内部 AI 调用时返回完整 key
 */
import { prisma } from '../lib/prisma.js';
import { buildChatCompletionsUrl, validateBaseUrl } from './aiService.js';

export interface ServerAIModel {
  id: string;
  userId: string;
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
  createdAt: Date;
  updatedAt: Date;
}

/** 默认全部能力 */
export const DEFAULT_CAPABILITIES = [
  'continue', 'rewrite', 'polish', 'expand',
  'outline', 'fulltext', 'dialogue', 'worldview',
] as const;

export type ModelCapability = (typeof DEFAULT_CAPABILITIES)[number];

/** 掩码 API Key，仅保留前 6 位 */
function maskApiKey(key: string): string {
  return key ? key.slice(0, 6) + '***' : '';
}

/** 返回掩码后的模型副本（不泄露 apiKey） */
function maskModel(m: ServerAIModel): ServerAIModel {
  return { ...m, apiKey: maskApiKey(m.apiKey) };
}

/** Prisma 行 → ServerAIModel（capabilities 字段从 string[] 直传） */
function toModel(row: {
  id: string;
  userId: string;
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
  createdAt: Date;
  updatedAt: Date;
}): ServerAIModel {
  return { ...row };
}

function normalizeCapabilities(capabilities?: readonly string[]): string[] {
  const source = capabilities?.length ? capabilities : DEFAULT_CAPABILITIES;
  return Array.from(new Set(source.map((cap) => cap.trim()).filter(Boolean)));
}

/** 列出某用户的所有模型（apiKey 掩码） */
export async function listModels(userId: string, includeKey = false): Promise<ServerAIModel[]> {
  const rows = await prisma.aIModel.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toModel).map((m) => (includeKey ? m : maskModel(m)));
}

/** 获取某用户的默认/激活模型（返回完整 key，供 AI 服务内部使用） */
export async function getActiveModel(userId: string): Promise<ServerAIModel | null> {
  // 优先 isDefault 且 enabled
  const def = await prisma.aIModel.findFirst({
    where: { userId, isDefault: true, enabled: true },
  });
  if (def) return toModel(def);
  // 否则取该用户第一个 enabled 模型
  const first = await prisma.aIModel.findFirst({
    where: { userId, enabled: true },
    orderBy: { createdAt: 'asc' },
  });
  return first ? toModel(first) : null;
}

/** 获取某用户的默认模型 ID */
export async function getActiveModelId(userId: string): Promise<string | null> {
  const m = await getActiveModel(userId);
  return m?.id ?? null;
}

/** 获取单个模型（apiKey 掩码，除非 includeKey=true） */
export async function getModel(
  userId: string,
  id: string,
  includeKey = false,
): Promise<ServerAIModel | null> {
  const row = await prisma.aIModel.findFirst({ where: { id, userId } });
  if (!row) return null;
  const m = toModel(row);
  return includeKey ? m : maskModel(m);
}

export interface CreateModelInput {
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
}

/** 创建模型（绑定 userId） */
export async function createModel(
  userId: string,
  input: CreateModelInput,
): Promise<ServerAIModel> {
  // SSRF 防护：写入前校验 baseUrl
  const urlCheck = validateBaseUrl(input.baseUrl);
  if (!urlCheck.ok) {
    throw new Error(`baseUrl 校验失败：${urlCheck.message}`);
  }

  const created = await prisma.$transaction(async (tx) => {
    const count = await tx.aIModel.count({ where: { userId } });
    const isDefault = input.enabled && (input.isDefault || count === 0);

    if (isDefault) {
      await tx.aIModel.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.aIModel.create({
      data: {
        userId,
        name: input.name,
        provider: input.provider,
        modelId: input.modelId,
        apiKey: input.apiKey,
        baseUrl: input.baseUrl,
        enabled: input.enabled,
        isDefault,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        capabilities: normalizeCapabilities(input.capabilities),
      },
    });
  });
  return maskModel(toModel(created));
}

export async function updateModel(
  userId: string,
  id: string,
  patch: Partial<CreateModelInput>,
): Promise<ServerAIModel | null> {
  // SSRF 防护：若更新了 baseUrl 则校验
  if (patch.baseUrl !== undefined) {
    const urlCheck = validateBaseUrl(patch.baseUrl);
    if (!urlCheck.ok) {
      throw new Error(`baseUrl 校验失败：${urlCheck.message}`);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.aIModel.findFirst({ where: { id, userId } });
    if (!existing) return null;

    const nextEnabled = patch.enabled ?? existing.enabled;
    const requestedDefault = patch.isDefault ?? existing.isDefault;
    const nextIsDefault = nextEnabled && requestedDefault;

    if (nextIsDefault) {
      await tx.aIModel.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updatedModel = await tx.aIModel.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.provider !== undefined && { provider: patch.provider }),
        ...(patch.modelId !== undefined && { modelId: patch.modelId }),
        ...(patch.apiKey !== undefined && { apiKey: patch.apiKey }),
        ...(patch.baseUrl !== undefined && { baseUrl: patch.baseUrl }),
        ...(patch.enabled !== undefined && { enabled: patch.enabled }),
        ...(patch.isDefault !== undefined || patch.enabled !== undefined
          ? { isDefault: nextIsDefault }
          : {}),
        ...(patch.temperature !== undefined && { temperature: patch.temperature }),
        ...(patch.maxTokens !== undefined && { maxTokens: patch.maxTokens }),
        ...(patch.capabilities !== undefined && {
          capabilities: normalizeCapabilities(patch.capabilities),
        }),
        updatedAt: new Date(),
      },
    });

    const hasDefault = await tx.aIModel.findFirst({
      where: { userId, isDefault: true, enabled: true },
      select: { id: true },
    });
    if (!hasDefault) {
      const candidate = await tx.aIModel.findFirst({
        where: { userId, enabled: true },
        orderBy: { createdAt: 'asc' },
      });
      if (candidate) {
        const fallback = await tx.aIModel.update({
          where: { id: candidate.id },
          data: { isDefault: true },
        });
        return candidate.id === updatedModel.id ? fallback : updatedModel;
      }
    }

    return updatedModel;
  });
  if (!updated) return null;
  return maskModel(toModel(updated));
}

export async function deleteModel(userId: string, id: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.aIModel.findFirst({ where: { id, userId } });
    if (!existing) return false;

    await tx.aIModel.delete({ where: { id } });

    if (existing.isDefault) {
      const candidate = await tx.aIModel.findFirst({
        where: { userId, enabled: true },
        orderBy: { createdAt: 'asc' },
      });
      if (candidate) {
        await tx.aIModel.update({
          where: { id: candidate.id },
          data: { isDefault: true },
        });
      }
    }
    return true;
  });
}

/** 设为默认模型（仅该用户范围内） */
export async function setActiveModel(userId: string, id: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const m = await tx.aIModel.findFirst({ where: { id, userId } });
    if (!m || !m.enabled) return false;

    await tx.aIModel.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
    await tx.aIModel.update({
      where: { id },
      data: { isDefault: true },
    });
    return true;
  });
}

/** 测试连通性 — 直接复用 aiService.ts 里的逻辑 */
export async function testModel(
  userId: string,
  id: string,
): Promise<{ ok: boolean; message: string }> {
  const m = await getModel(userId, id, true);
  if (!m) return { ok: false, message: '模型不存在' };
  if (!m.modelId || !m.baseUrl) return { ok: false, message: '缺少模型 ID 或 API 地址' };
  // SSRF 防护：校验 baseUrl
  const urlCheck = validateBaseUrl(m.baseUrl);
  if (!urlCheck.ok) return { ok: false, message: `baseUrl 校验失败：${urlCheck.message}` };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(buildChatCompletionsUrl(m.baseUrl), {
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
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, message: '连接超时' };
    }
    const message = err instanceof Error ? err.message : '未知错误';
    return { ok: false, message: `网络错误: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}
