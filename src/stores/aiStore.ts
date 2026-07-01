/**
 * AI 写作 Store
 *
 * 管理 AI 任务状态、流式输出缓存、历史记录与 AbortController。
 * 纯内存 store（不持久化），刷新后清空。
 */
import { create } from 'zustand';
import type { AIStatus, AIHistoryItem, AITaskType } from '../types/ai';

export interface AIStore {
  /** 当前任务状态 */
  status: AIStatus;
  /** 当前任务的流式输出（实时累积） */
  streamText: string;
  /** 最近一次错误信息 */
  error: string | null;
  /** AI 历史记录（最近 50 条） */
  history: AIHistoryItem[];
  /** 当前请求的 AbortController（用于取消） */
  abortController: AbortController | null;

  /** 设置状态 */
  setStatus: (status: AIStatus) => void;
  /** 追加流式文本片段 */
  appendStreamText: (chunk: string) => void;
  /** 重置流式文本 */
  resetStream: () => void;
  /** 设置错误 */
  setError: (error: string | null) => void;
  /** 注册 AbortController */
  setAbortController: (controller: AbortController | null) => void;

  /** 取消当前请求 */
  cancel: () => void;
  /** 添加历史记录 */
  addHistory: (item: Omit<AIHistoryItem, 'id' | 'createdAt'>) => void;
  /** 清空历史记录 */
  clearHistory: () => void;
}

const MAX_HISTORY = 50;

export const useAIStore = create<AIStore>((set, get) => ({
  status: 'idle',
  streamText: '',
  error: null,
  history: [],
  abortController: null,

  setStatus: (status) => set({ status }),
  appendStreamText: (chunk) =>
    set((state) => ({ streamText: state.streamText + chunk })),
  resetStream: () => set({ streamText: '', error: null }),
  setError: (error) => set({ error, status: 'error' }),
  setAbortController: (controller) => set({ abortController: controller }),

  cancel: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({ status: 'idle', abortController: null, streamText: '' });
  },

  addHistory: (item) =>
    set((state) => ({
      history: [
        {
          ...item,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        },
        ...state.history,
      ].slice(0, MAX_HISTORY),
    })),

  clearHistory: () => set({ history: [] }),
}));

/**
 * 启动一个 AI 流式任务的便捷 Hook 工厂。
 *
 * 返回 start 函数，调用后自动管理 status/streamText/history/abort。
 */
export function createAITask(
  taskType: AITaskType,
  run: (
    onChunk: (chunk: string) => void,
    signal: AbortSignal,
  ) => Promise<string>,
): {
  start: (prompt: string, meta?: { bookId?: string; chapterId?: string }) => Promise<string>;
} {
  return {
    start: async (prompt, meta) => {
      const store = useAIStore.getState();
      // 取消进行中的任务
      if (store.status === 'loading' || store.status === 'streaming') {
        store.cancel();
      }

      const controller = new AbortController();
      store.setAbortController(controller);
      store.resetStream();
      store.setStatus('loading');

      try {
        const full = await run(
          (chunk) => {
            const s = useAIStore.getState();
            s.appendStreamText(chunk);
            if (s.status !== 'streaming') s.setStatus('streaming');
          },
          controller.signal,
        );

        const done = useAIStore.getState();
        done.setStatus('done');
        done.addHistory({
          taskType,
          prompt,
          output: full,
          bookId: meta?.bookId,
          chapterId: meta?.chapterId,
        });

        // 清理 controller
        useAIStore.getState().setAbortController(null);
        return full;
      } catch (err) {
        const s = useAIStore.getState();
        s.setError(err instanceof Error ? err.message : String(err));
        s.setAbortController(null);
        throw err;
      }
    },
  };
}
