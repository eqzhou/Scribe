/**
 * 应用部署基础路径工具。
 *
 * 生产环境可能挂载在域名子路径（例如 https://www.flyai.cloud/Scribe/）。
 * 统一在这里处理基础路径，避免 href="/..."、fetch('/api/...') 在子路径部署时跳到域名根目录。
 */

const KNOWN_BASE_PATHS = ['/Scribe'] as const;

function normalizeBasePath(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') return '';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function detectBasePathFromLocation(): string {
  if (typeof window === 'undefined') return '';
  const pathname = window.location.pathname;
  return KNOWN_BASE_PATHS.find((base) => pathname === base || pathname.startsWith(`${base}/`)) ?? '';
}

/** 当前应用基础路径：本地根部署为 ''，/Scribe 子路径部署为 '/Scribe'。 */
export function getAppBasePath(): string {
  const envBase = normalizeBasePath(import.meta.env.VITE_APP_BASE_PATH);
  return envBase || detectBasePathFromLocation();
}

/** 给站内路径加上部署前缀。外部 URL、协议相对 URL、hash 锚点原样返回。 */
export function withAppBasePath(path: string): string {
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(path) || path.startsWith('//') || path.startsWith('#')) {
    return path;
  }

  const base = getAppBasePath();
  if (!path || path === '/') {
    return base ? `${base}/` : '/';
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/** 构造同源 API 请求路径。 */
export function apiPath(path: string): string {
  return withAppBasePath(path);
}

/** 判断当前是否已经在登录页，避免 401 跳转死循环。 */
export function isLoginPath(pathname = typeof window !== 'undefined' ? window.location.pathname : ''): boolean {
  const base = getAppBasePath();
  return pathname === `${base}/login` || pathname.startsWith(`${base}/login?`);
}
