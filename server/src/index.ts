import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import type { ErrorRequestHandler, RequestHandler } from 'express';

// 显式加载项目根目录 .env（包含 DATABASE_URL 与 JWT_SECRET）
// 必须在导入 prisma/auth 等依赖 env 的模块之前完成
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_ENV = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(ROOT_ENV)) {
  dotenv.config({ path: ROOT_ENV });
}

import { router as aiRouter } from './routes/ai.js';
import { modelRouter } from './routes/models.js';
import { router as authRouter } from './routes/auth.js';
import { router as booksRouter } from './routes/books.js';
import { router as volumesRouter } from './routes/volumes.js';
import { router as chaptersRouter } from './routes/chapters.js';
import { router as charactersRouter } from './routes/characters.js';
import { router as relationsRouter } from './routes/relations.js';
import { router as worldviewRouter } from './routes/worldview.js';
import { router as scenesRouter } from './routes/scenes.js';
import { router as plotLinesRouter } from './routes/plot-lines.js';
import { router as plotPointsRouter } from './routes/plot-points.js';
import { router as foreshadowingRouter } from './routes/foreshadowing.js';
import { router as inspirationRouter } from './routes/inspiration.js';
import { router as writingLogsRouter } from './routes/writing-logs.js';
import { requireAuth } from './middleware/auth.js';

const app = express();
const PORT = Number(process.env.PORT ?? 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';

function normalizeBasePath(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') return '';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

// 线上当前挂载在 /Scribe；仍保留根路径，保证本地与根部署不受影响。
const APP_BASE_PATH = normalizeBasePath(process.env.APP_BASE_PATH ?? '/Scribe');
const mountPaths = (pathPrefix: string): string[] => (
  APP_BASE_PATH ? [pathPrefix, `${APP_BASE_PATH}${pathPrefix}`] : [pathPrefix]
);

// CORS：仅允许配置的前端来源（生产模式下前后端同源，CORS 不会触发）
app.use(cors({ origin: ALLOWED_ORIGIN }));
// 请求体大小限制 5MB（支持大段文本生成）
app.use(express.json({ limit: '5mb' }));

// 认证路由（无需认证）
app.use(mountPaths('/api/auth'), authRouter);

// 其余 /api/* 路由全部应用 requireAuth 中间件
app.use(mountPaths('/api/ai'), requireAuth, aiRouter);
app.use(mountPaths('/api'), requireAuth, modelRouter);
app.use(mountPaths('/api'), requireAuth, booksRouter);
app.use(mountPaths('/api'), requireAuth, volumesRouter);
app.use(mountPaths('/api'), requireAuth, chaptersRouter);
app.use(mountPaths('/api'), requireAuth, charactersRouter);
app.use(mountPaths('/api'), requireAuth, relationsRouter);
app.use(mountPaths('/api'), requireAuth, worldviewRouter);
app.use(mountPaths('/api'), requireAuth, scenesRouter);
app.use(mountPaths('/api'), requireAuth, plotLinesRouter);
app.use(mountPaths('/api'), requireAuth, plotPointsRouter);
app.use(mountPaths('/api'), requireAuth, foreshadowingRouter);
app.use(mountPaths('/api'), requireAuth, inspirationRouter);
app.use(mountPaths('/api'), requireAuth, writingLogsRouter);

// API 未匹配时始终返回 JSON，避免前端把 Express 默认 HTML 404 作为错误正文展示。
app.use(mountPaths('/api'), (_req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 静态文件托管：生产模式下直接由后端服务提供前端构建产物
// __dirname 在 ESM 下需要通过 fileURLToPath 构造
// server/dist/..  = 项目根目录，dist/ 即前端构建产物
const STATIC_ROOT = path.resolve(__dirname, '..', '..', 'dist');
const PUBLIC_ROOT = path.resolve(__dirname, '..', '..', 'public');

// 静态资源（带 hash 的 js/css/图片等）
app.use(mountPaths('/assets'), express.static(path.join(STATIC_ROOT, 'assets'), {
  immutable: true,
  maxAge: '1y',
}));

// favicon、icons.svg、落地页截图等根目录静态文件。
// dist 缺少 public 拷贝时，从源码 public/ 兜底，避免源码部署后首页图片 404。
app.use(express.static(STATIC_ROOT, {
  maxAge: '1h',
  index: false,
}));
app.use(express.static(PUBLIC_ROOT, {
  maxAge: '1h',
  index: false,
}));
if (APP_BASE_PATH) {
  app.use(APP_BASE_PATH, express.static(STATIC_ROOT, {
    maxAge: '1h',
    index: false,
    redirect: false,
  }));
  app.use(APP_BASE_PATH, express.static(PUBLIC_ROOT, {
    maxAge: '1h',
    index: false,
    redirect: false,
  }));
}

if (APP_BASE_PATH) {
  app.get(APP_BASE_PATH, (req, res, next) => {
    if (req.originalUrl === APP_BASE_PATH) {
      res.redirect(308, `${APP_BASE_PATH}/`);
      return;
    }
    next();
  });
}

// 根路径直接返回落地页
app.get(APP_BASE_PATH ? ['/', `${APP_BASE_PATH}/`] : '/', (_req, res, next) => {
  res.sendFile(path.join(STATIC_ROOT, 'landing.html'), (err) => {
    if (err) next(err);
  });
});

function isSubpathRequest(pathname: string): boolean {
  return !!APP_BASE_PATH && (pathname === APP_BASE_PATH || pathname.startsWith(`${APP_BASE_PATH}/`));
}

function prefixAssetPathsForSubpath(html: string): string {
  if (!APP_BASE_PATH) return html;
  return html.replace(/(src|href)="\/assets\//g, `$1="${APP_BASE_PATH}/assets/`);
}

// SPA fallback：所有未匹配的 GET 请求统一返回 index.html，交由前端路由处理。
// /Scribe/* 子路径部署时，动态把 Vite 产物里的 /assets 改成 /Scribe/assets，
// 避免资源请求落到域名根路径的其它应用。
const spaFallback: RequestHandler = (req, res, next) => {
  const indexPath = path.join(STATIC_ROOT, 'index.html');
  if (!isSubpathRequest(req.path)) {
    res.sendFile(indexPath, (err) => {
      if (err) next(err);
    });
    return;
  }

  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) {
      next(err);
      return;
    }
    res.type('html').send(prefixAssetPathsForSubpath(html));
  });
};
app.get('*', spaFallback);

// 全局错误处理中间件：捕获 body 解析等未处理错误
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const message = err instanceof Error ? err.message : '服务器内部错误';
  res.status(500).json({ error: message });
};
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`scribe-server listening on http://localhost:${PORT}`);
  console.log(`static root: ${STATIC_ROOT}`);
});
