/**
 * 通用 Repository 基础工厂（API 版）
 *
 * 依据《技术架构文档》第 8.2 节 Repository 接口签名实现。
 * 通过 REST API 与后端通信，自动处理：
 * - ISO 时间字符串 → Unix 毫秒时间戳的转换
 * - 写入时剥离 id / createdAt / updatedAt（由后端生成）
 * - bulkCreate / listByIds 用循环模拟（后端无批量端点）
 */
import { apiGet, apiPost, apiPatch, apiDelete } from '../api';

/**
 * 通用 Repository 接口，约束所有实体 Repository 的对外方法。
 */
export interface Repository<T> {
  /** 列出某作品下的全部实体（按 bookId 过滤） */
  list(bookId: string): Promise<T[]>;
  /** 按主键获取单个实体 */
  get(id: string): Promise<T | undefined>;
  /** 创建实体，后端自动生成 id 与 createdAt/updatedAt */
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  /** 部分更新实体 */
  update(id: string, patch: Partial<T>): Promise<T>;
  /** 删除实体（引用检测由 referenceChecker 在 UI 层调用，此处不做检测） */
  delete(id: string): Promise<void>;
  /** 批量创建，用于导入 */
  bulkCreate(entities: T[]): Promise<T[]>;
  /** 按主键集合批量查询，用于关联查询 */
  listByIds(ids: string[]): Promise<T[]>;
}

/**
 * 将单个实体中的 ISO 时间字符串字段转换为 Unix 毫秒。
 * 仅对值为字符串的 createdAt/updatedAt 字段生效，对已是数字的字段无影响。
 */
function normalizeTimestamps<T>(entity: T): T {
  if (!entity || typeof entity !== 'object') return entity;
  const result = { ...entity } as Record<string, unknown>;
  for (const key of ['createdAt', 'updatedAt'] as const) {
    const v = result[key];
    if (typeof v === 'string' && v.length > 0) {
      const ms = new Date(v).getTime();
      if (!Number.isNaN(ms)) {
        result[key] = ms;
      }
    }
  }
  return result as T;
}

/** 批量应用时间戳转换 */
function normalizeList<T>(list: T[]): T[] {
  return list.map(normalizeTimestamps);
}

/**
 * 工厂配置：
 * - entityPath: 单实体操作路径，如 (id) => `/api/chapters/${id}`
 * - collectionPath: 按作品列出实体路径，如 (bookId) => `/api/books/${bookId}/chapters`
 * - createPath: 创建实体路径（POST），默认与 collectionPath 相同；可自定义以支持
 *   "POST /api/books/:bookId/{entity}" 与 "POST /api/{entity}" 两种风格
 */
export interface ApiRepositoryConfig {
  /** 单实体路径（GET/PATCH/DELETE） */
  entityPath: (id: string) => string;
  /** 作品级集合路径（GET 列表） */
  collectionPath: (bookId: string) => string;
  /**
   * 创建实体路径（POST）。可选，默认与 collectionPath(bookId) 相同。
   * 入参为待创建实体（已剥离 id / createdAt / updatedAt），便于从中取 bookId。
   */
  createPath?: (payload: Record<string, unknown>) => string;
}

/**
 * 创建通用 API Repository 实例。
 *
 * 各子 Repository 可在此基础上扩展（如 list 接受额外过滤参数、增加 listByPlotLine 等方法）。
 */
export function createApiRepository<T>(
  config: ApiRepositoryConfig,
): Repository<T> {
  // 默认创建路径：从 payload 中读取 bookId，构造 /api/books/:bookId/{entityPlural}
  const resolveCreatePath = (payload: Record<string, unknown>): string => {
    if (config.createPath) return config.createPath(payload);
    const bookId = typeof payload.bookId === 'string' ? payload.bookId : '';
    return config.collectionPath(bookId);
  };

  return {
    async list(bookId: string): Promise<T[]> {
      const items = await apiGet<T[]>(config.collectionPath(bookId));
      return normalizeList(items ?? []);
    },

    async get(id: string): Promise<T | undefined> {
      try {
        const item = await apiGet<T>(config.entityPath(id));
        return item ? normalizeTimestamps(item) : undefined;
      } catch (err) {
        // 404 视为未找到，返回 undefined；其他错误继续抛出
        if (err instanceof Error && /不存在|not found|404/i.test(err.message)) {
          return undefined;
        }
        throw err;
      }
    },

    async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
      // 剥离可能存在的 id / createdAt / updatedAt（防御性处理）
      const payload = stripGeneratedFields(entity);
      const path = resolveCreatePath(payload as Record<string, unknown>);
      const created = await apiPost<T>(path, payload);
      return normalizeTimestamps(created);
    },

    async update(id: string, patch: Partial<T>): Promise<T> {
      // 更新时同样剥离 id / createdAt / updatedAt，避免覆盖后端值
      const payload = stripGeneratedFields(patch);
      const updated = await apiPatch<T>(config.entityPath(id), payload);
      return normalizeTimestamps(updated);
    },

    async delete(id: string): Promise<void> {
      await apiDelete(config.entityPath(id));
    },

    async bulkCreate(entities: T[]): Promise<T[]> {
      // 后端无批量端点，按顺序循环 create（避免并发触发限流）
      const results: T[] = [];
      for (const entity of entities) {
        const payload = stripGeneratedFields(entity as Record<string, unknown>);
        const path = resolveCreatePath(payload as Record<string, unknown>);
        const created = await apiPost<T>(path, payload);
        results.push(normalizeTimestamps(created));
      }
      return results;
    },

    async listByIds(ids: string[]): Promise<T[]> {
      if (ids.length === 0) return [];
      // 后端无按 id 集合查询端点，并发调用 get
      const results = await Promise.all(
        ids.map((id) =>
          apiGet<T | undefined>(config.entityPath(id)).catch(() => undefined),
        ),
      );
      // 过滤掉 undefined（404 或失败），剩余为有效实体
      const filtered = results.filter((r): r is NonNullable<typeof r> => r !== undefined);
      return normalizeList(filtered as T[]);
    },
  };
}

/**
 * 从 payload 中剥离 id / createdAt / updatedAt 字段。
 * 这些字段由后端自动生成，前端不应在 create / update 时传入。
 */
function stripGeneratedFields<T>(payload: T): Partial<T> {
  if (!payload || typeof payload !== 'object') return payload as Partial<T>;
  const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = payload as Record<string, unknown>;
  return rest as Partial<T>;
}
