import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { router as aiRouter } from './routes/ai.js';
import { modelRouter } from './routes/models.js';

const app = express();
const PORT = Number(process.env.PORT ?? 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';

// CORS：仅允许配置的前端来源（生产模式下前后端同源，CORS 不会触发）
app.use(cors({ origin: ALLOWED_ORIGIN }));
// 请求体大小限制 5MB（支持大段文本生成）
app.use(express.json({ limit: '5mb' }));

// AI 路由
app.use('/api/ai', aiRouter);
// 模型配置管理路由
app.use('/api/models', modelRouter);

// 静态文件托管：生产模式下直接由后端服务提供前端构建产物
// __dirname 在 ESM 下需要通过 fileURLToPath 构造
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// server/dist/..  = 项目根目录，dist/ 即前端构建产物
const STATIC_ROOT = path.resolve(__dirname, '..', '..', 'dist');

// 静态资源（带 hash 的 js/css/图片等）
app.use('/assets', express.static(path.join(STATIC_ROOT, 'assets'), {
  immutable: true,
  maxAge: '1y',
}));

// favicon、icons.svg 等根目录静态文件
app.use(express.static(STATIC_ROOT, {
  maxAge: '1h',
  index: false,
}));

// SPA fallback：所有未匹配的 GET 请求统一返回 index.html，交由前端路由处理
const spaFallback: RequestHandler = (_req, res, next) => {
  res.sendFile(path.join(STATIC_ROOT, 'index.html'), (err) => {
    if (err) next(err);
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
