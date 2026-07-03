/**
 * 认证 API 客户端
 *
 * 与后端 /api/auth/* 接口对接：
 * - POST /api/auth/register  注册
 * - POST /api/auth/login     登录
 * - GET  /api/auth/me        获取当前用户（需 Bearer token）
 *
 * 同源部署，API_BASE 留空。
 */
import type { AuthResponse, User } from '../types';

/** API 基础地址（同源留空） */
const API_BASE = '';

/**
 * 注册新用户
 *
 * @param username   用户名
 * @param password   密码
 * @param displayName 显示名（可选）
 */
export async function register(
  username: string,
  password: string,
  displayName?: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, displayName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: '注册失败' }));
    throw new Error(data.error);
  }
  return res.json();
}

/**
 * 用户登录
 *
 * @param username 用户名
 * @param password 密码
 */
export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: '登录失败' }));
    throw new Error(data.error);
  }
  return res.json();
}

/**
 * 使用 token 获取当前用户信息
 *
 * @param token Bearer token
 */
export async function fetchCurrentUser(token: string): Promise<User> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('token 无效');
  return res.json();
}
