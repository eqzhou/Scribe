/**
 * 自动保存 Hook
 *
 * 依据《PRD》第 5.1 节自动保存机制实现。
 * 行为：
 *   - 内容变化后 debounce 1500ms 触发保存
 *   - 保存时更新 chapter 的 content / wordCount / updatedAt，并将 status 从 draft 提升为 writing
 *   - 同步更新当日 WritingLog（按字数增量累加，同一会话合并到同一条 log）
 *   - 失败自动重试，最多 3 次，每次间隔 5 秒
 *   - 3 次均失败后设置 saveStatus = 'failed'，未保存内容保留在内存中
 *   - 成功后设置 saveStatus = 'saved'，并记录 lastSavedAt
 *   - 当 chapterId 为 null 时不执行保存
 *   - 通过返回的 saveNow 可立即清除 debounce 定时器并触发保存
 *   - 章节内容超过 100KB 时通过回调 onOversize 通知 UI
 */
import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useToastStore } from '../stores';
import { chapterRepository, writingLogRepository } from '../lib/repositories';
import { countWords } from '../utils/wordCount';
import { todayDate } from '../utils/date';

/** debounce 触发间隔（毫秒） */
const DEBOUNCE_MS = 1500;
/** 失败重试间隔（毫秒） */
const RETRY_INTERVAL_MS = 5000;
/** 最大尝试次数（含首次） */
const MAX_ATTEMPTS = 3;
/** 章节内容大小上限（字节），超出时提示用户 */
const CONTENT_SIZE_LIMIT = 100 * 1024;

/**
 * 自动保存章节内容。
 *
 * @param chapterId 当前章节 ID；为 null 时不执行任何保存
 * @param content 当前未保存的章节内容
 * @returns saveNow：立即触发一次保存（清除待执行的 debounce 定时器）
 */
export function useAutoSave(chapterId: string | null, content: string) {
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus);
  const setLastSavedAt = useEditorStore((s) => s.setLastSavedAt);

  // debounce 定时器句柄
  const timerRef = useRef<number | null>(null);
  // 重试定时器句柄
  const retryTimerRef = useRef<number | null>(null);
  // 已尝试次数（成功后归零）
  const retryCountRef = useRef(0);
  // 最新内容与章节 ID 的引用，供异步 doSave 读取
  const contentRef = useRef(content);
  const chapterIdRef = useRef(chapterId);
  // 并发锁：当前是否有保存进行中
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  // pending 标志：保存进行中又有新内容进来，需在当前保存结束后再保存一次
  const pendingRef = useRef(false);
  // 当前会话的 WritingLog ID（同一会话内多次保存更新同一条）
  const sessionLogIdRef = useRef<string | null>(null);
  // 当前会话的累计字数增量（用于会话内累加）
  const sessionWordDeltaRef = useRef(0);
  // 会话开始时间戳（毫秒），用于计算写作时长
  const sessionStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    chapterIdRef.current = chapterId;
    // 切换章节时重置会话状态，新章节开启新的写作会话
    if (chapterId) {
      sessionLogIdRef.current = null;
      sessionWordDeltaRef.current = 0;
      sessionStartTimeRef.current = Date.now();
    }
  }, [chapterId]);

  const doSave = useCallback(async () => {
    // 并发锁：已有保存进行中，标记 pending 并等待当前完成
    if (inFlightPromiseRef.current) {
      pendingRef.current = true;
      return inFlightPromiseRef.current;
    }

    const promise = (async () => {
      const id = chapterIdRef.current;
      const text = contentRef.current;
      // chapterId 为 null 时跳过保存
      if (!id) return;

      setSaveStatus('saving');
      try {
        const chapter = await chapterRepository.get(id);
        if (!chapter) {
          throw new Error(`章节 ${id} 不存在，无法保存`);
        }

        const newWordCount = countWords(text);
        const delta = newWordCount - chapter.wordCount;
        // draft 状态在首次保存时提升为 writing；其它状态保持不变
        const nextStatus = chapter.status === 'draft' ? 'writing' : chapter.status;

        await chapterRepository.update(id, {
          content: text,
          wordCount: newWordCount,
          status: nextStatus,
        });

        // 同步更新当日 WritingLog（字数增量，下限为 0 避免负数）
        const today = todayDate();
        const durationSec = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);

        if (sessionLogIdRef.current) {
          // 同一会话内：更新已有 log，累加字数增量，刷新写作时长
          sessionWordDeltaRef.current += delta;
          await writingLogRepository.update(sessionLogIdRef.current, {
            wordCount: Math.max(0, sessionWordDeltaRef.current),
            duration: durationSec,
          });
        } else {
          // 新会话：查找当日是否已有该书籍的记录
          const logs = await writingLogRepository.listByDateRange(
            chapter.bookId,
            today,
            today,
          );
          const todayLog = logs[0];
          if (todayLog) {
            // 当日已有记录：在已有基础上累加（继续使用当日第一条作为会话 log）
            sessionLogIdRef.current = todayLog.id;
            sessionWordDeltaRef.current = todayLog.wordCount + delta;
            await writingLogRepository.update(todayLog.id, {
              wordCount: Math.max(0, sessionWordDeltaRef.current),
              duration: Math.max(todayLog.duration, durationSec),
            });
          } else {
            // 当日无记录：创建新 log
            const newLog = await writingLogRepository.create({
              bookId: chapter.bookId,
              date: today,
              wordCount: Math.max(0, delta),
              duration: durationSec,
            });
            sessionLogIdRef.current = newLog.id;
            sessionWordDeltaRef.current = Math.max(0, delta);
          }
        }

        setSaveStatus('saved');
        setLastSavedAt(Date.now());
        retryCountRef.current = 0;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        retryCountRef.current += 1;
        if (retryCountRef.current >= MAX_ATTEMPTS) {
          setSaveStatus('failed');
          useToastStore.getState().pushToast(
            'error',
            `自动保存失败：${message}。请检查浏览器存储状态或导出作品备份。`,
          );
        } else {
          // 安排 5 秒后重试
          retryTimerRef.current = window.setTimeout(() => {
            void doSave();
          }, RETRY_INTERVAL_MS);
        }
      }
    })();

    inFlightPromiseRef.current = promise;
    try {
      await promise;
    } finally {
      inFlightPromiseRef.current = null;
      // 保存期间又有新内容进来：再保存一次最新内容
      if (pendingRef.current) {
        pendingRef.current = false;
        void doSave();
      }
    }
  }, [setSaveStatus, setLastSavedAt]);

  // 内容变化时设置 debounce 定时器
  useEffect(() => {
    if (!chapterId) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      void doSave();
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [chapterId, content, doSave]);

  // 卸载时清理重试定时器
  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  // 手动保存：清除 debounce 与重试定时器后立即触发
  // 若当前已有自动保存进行中，先等待其完成再触发新的保存，避免并发导致字数双倍计数
  const saveNow = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    retryCountRef.current = 0;
    // 等待当前 in-flight 保存完成（若有），取消其 pending 重试
    if (inFlightPromiseRef.current) {
      pendingRef.current = false;
      await inFlightPromiseRef.current;
    }
    await doSave();
  }, [doSave]);

  return { saveNow };
}

/**
 * 工具函数：检测章节内容是否超过大小上限。
 * 供编辑器 UI 调用以展示提示横幅。
 */
export function isContentOversize(content: string): boolean {
  // 按 UTF-16 码元计算字节数近似值（中文占 3 字节 UTF-8，这里用长度 * 2 近似上限判定）
  return content.length * 2 > CONTENT_SIZE_LIMIT;
}
