/**
 * useApiQuery - 轮询式 API 查询 Hook
 *
 * 行为：
 * - 首次渲染立即触发请求
 * - deps 变化时立即重新请求
 * - 通过 setInterval 定时轮询，保持数据同步
 * - 组件卸载时清理定时器与进行中的请求
 *
 * 返回 T | undefined：首次加载未完成时为 undefined，由调用方按需 ?? [] 兜底。
 */
import { useEffect, useRef, useState } from 'react';

/**
 * @param fetcher 数据获取函数（应返回 Promise<T>）
 * @param deps 依赖数组，变化时立即重新请求并重置轮询
 * @param intervalMs 轮询间隔，默认 5000ms
 */
export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  intervalMs = 5000,
): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);
  // 用 ref 保存 fetcher，避免它每次渲染变化导致 effect 频繁重启
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  // 进行中请求的 AbortController，避免竞态：旧请求结果被新请求覆盖
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        const result = await fetcherRef.current();
        if (!cancelled && abortRef.current === controller) {
          setData(result);
        }
      } catch {
        // 静默失败：错误状态由调用方按需在 fetcher 内部通过 toast 提示
        // 轮询失败时不更新 state，保留上一次的数据
      }
    };

    // 立即触发一次
    void run();
    const timer = window.setInterval(run, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs]);

  return data;
}
