/**
 * 通用 REST API 客户端
 *
 * 与后端 /api/* 接口对接：
 * - 自动从 localStorage 读取 JWT token（key: scribe-token），附加到 Authorization: Bearer header
 * - 401 响应时清除 token 并跳转 /login
 * - 非 ok 响应抛出 Error（含服务器返回的 error 消息）
 *
 * 同源部署，路径以 /api 开头，由 vite 代理或后端静态托管。
 */

/** localStorage 中保存 JWT token 的 key */
const TOKEN_KEY = 'scribe-token';

/** 读取当前 JWT token */
function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** 清除 token 并跳转登录页（避免在登录页本身触发跳转造成死循环） */
function handleUnauthorized(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 忽略 localStorage 不可用错误
  }
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

/** 构造请求头：默认 JSON，若有 token 则附加 Authorization */
function buildHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (extra) {
    Object.assign(headers, extra);
  }
  return headers;
}

/**
 * 解析错误响应：优先取 server 返回的 { error: string }，其次 statusText。
 */
async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.clone().json()) as unknown;
    if (data && typeof data === 'object' && 'error' in data) {
      const err = (data as { error: unknown }).error;
      if (typeof err === 'string') return err;
    }
  } catch {
    // 非 JSON 响应，回退到文本
  }
  try {
    const text = await res.text();
    if (text) {
      if (/^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text)) {
        return `服务器返回 HTML 错误页（${res.status}）`;
      }
      return text.length > 200 ? `${text.slice(0, 200)}...` : text;
    }
  } catch {
    // 忽略
  }
  return res.statusText || `请求失败（${res.status}）`;
}

/**
 * 通用请求方法。
 *
 * @param method HTTP 方法
 * @param path 请求路径（以 /api 开头）
 * @param body 请求体（可选）
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: buildHeaders(),
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (err) {
    // 网络层错误（DNS、断网、CORS 失败等）
    throw new Error(
      err instanceof Error ? `网络请求失败：${err.message}` : '网络请求失败',
    );
  }

  // 401：token 失效或缺失，清除并跳转登录
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('登录已失效，请重新登录');
  }

  if (!res.ok) {
    const message = await parseError(res);
    throw new Error(message);
  }

  // 204 No Content 或空响应体：返回 undefined 强转为 T
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    // 非 JSON 响应：原样返回字符串
    return text as unknown as T;
  }
}

/** GET 请求 */
export function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

/** POST 请求（带请求体） */
export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

/** PATCH 请求（带请求体） */
export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}

/** PUT 请求（带请求体） */
export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PUT', path, body);
}

/** DELETE 请求 */
export function apiDelete<T = void>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}
