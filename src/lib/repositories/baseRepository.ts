/**
 * 通用 Repository 基础工厂
 *
 * 依据《技术架构文档》第 8.2 节 Repository 接口签名实现。
 * 提供统一的 CRUD 与批量操作能力，各实体 Repository 在此基础上扩展。
 */
import type { Table } from 'dexie';

/**
 * 通用 Repository 接口，约束所有实体 Repository 的对外方法。
 */
export interface Repository<T> {
  /** 列出某作品下的全部实体（按 bookId 过滤） */
  list(bookId: string): Promise<T[]>;
  /** 按主键获取单个实体 */
  get(id: string): Promise<T | undefined>;
  /** 创建实体，自动生成 id 与 createdAt/updatedAt */
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  /** 部分更新实体，自动刷新 updatedAt（若实体存在该字段） */
  update(id: string, patch: Partial<T>): Promise<T>;
  /** 删除实体（引用检测由 referenceChecker 在 UI 层调用，此处不做检测） */
  delete(id: string): Promise<void>;
  /** 批量创建，用于导入与种子注入 */
  bulkCreate(entities: T[]): Promise<T[]>;
  /** 按主键集合批量查询，用于关联查询 */
  listByIds(ids: string[]): Promise<T[]>;
}

/**
 * 创建通用 Repository 实例。
 *
 * @param table Dexie Table 句柄
 * @param listFn 自定义 list 实现（按 bookId 过滤；Book 等无 bookId 实体可返回全部）
 */
export function createRepository<T extends { id: string }>(
  table: Table<T, string>,
  listFn: (bookId: string) => Promise<T[]>,
): Repository<T> {
  return {
    async list(bookId: string): Promise<T[]> {
      return listFn(bookId);
    },

    async get(id: string): Promise<T | undefined> {
      return await table.get(id);
    },

    async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
      const now = Date.now();
      // 自动生成 id（crypto.randomUUID 在现代浏览器与 Node 中可用）
      // 同时注入 createdAt/updatedAt；对未声明这两个字段的实体无害（多余字段不影响 Dexie 存储）
      const newEntity = {
        ...entity,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      } as unknown as T;
      await table.add(newEntity);
      return newEntity;
    },

    async update(id: string, patch: Partial<T>): Promise<T> {
      const existing = await table.get(id);
      if (!existing) {
        throw new Error(`实体 ${id} 不存在，无法更新`);
      }
      const updatedPatch: Partial<T> & { updatedAt?: number } = { ...patch };
      // 仅当实体本身具备 updatedAt 字段时才刷新，避免对无该字段的实体写入多余属性
      if ('updatedAt' in existing) {
        updatedPatch.updatedAt = Date.now();
      }
      const updated = { ...existing, ...updatedPatch } as T;
      await table.put(updated);
      return updated;
    },

    async delete(id: string): Promise<void> {
      await table.delete(id);
    },

    async bulkCreate(entities: T[]): Promise<T[]> {
      if (entities.length === 0) return entities;
      // bulkAdd 不会覆盖既有主键；导入场景需先清理旧数据
      await table.bulkAdd(entities);
      return entities;
    },

    async listByIds(ids: string[]): Promise<T[]> {
      if (ids.length === 0) return [];
      return await table.where('id').anyOf(ids).toArray();
    },
  };
}
