# Scribe — 专业小说创作系统

> A professional novel crafting system for writers worldwide.

Scribe 是一套面向小说作者的全栈创作工具，集成了项目管理、章节编辑、角色设定、世界观构建、剧情线管理、AI 辅助创作等功能。前端基于 React + TipTap 编辑器，后端提供 AI 模型管理与 OpenAI 兼容接口代理。

## 功能特性

- **作品管理** — 多作品支持，每部作品独立维护角色、世界观、剧情、场景
- **富文本编辑器** — 基于 TipTap 3，支持章节分卷、场景分割、角色提及、世界观引用、AI Ghost Text 流式插入
- **AI 辅助创作** — 续写、改写、润色、扩写、大纲生成、全文生成、角色对话、世界观构建
- **AI 批量生成** — 作品创建时一键生成 6 大分类世界观；CharacterForm 基于 prompt 生成角色档案；章节全文生成完成后自动提取新角色入库
- **多模型管理** — 支持 OpenAI / Anthropic / DeepSeek / 通义千问 / 豆包 / 智谱 / 月之暗面 / 自定义 8 类 OpenAI 兼容接口
- **角色系统** — 角色卡片、关系图谱、性格设定
- **世界观构建** — 分类管理（地理/历史/阵营/体系/文化/物品）、条目关联
- **剧情管理** — 剧情线、剧情节点、伏笔追踪、时间线
- **场景管理** — 场景卡片、视角切换、地点时间标注
- **写作仪表盘** — 字数统计、目标环、写作热力图、最近作品
- **灵感笔记** — 快速记录、分类标签
- **主题系统** — 6 套色彩主题（blue/vermilion/moss/purple/gold/rose）+ 明暗模式
- **数据导入导出** — 支持 JSON 格式备份与恢复
- **路由懒加载** — 10 个页面按需加载，独立 chunk 切分

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 8 |
| 富文本编辑 | TipTap 3 |
| 状态管理 | Zustand 5（含 persist 中间件） |
| 本地数据库 | Dexie 4 (IndexedDB，数据库名 `scribe`) |
| 样式 | Tailwind CSS 3 |
| 动画 | Framer Motion 12 |
| 后端 | Express + TypeScript (ESM) |
| 进程管理 | PM2 |
| 包管理 | npm |

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装

```bash
# 克隆仓库
git clone https://github.com/eqzhou/Scribe.git
cd Scribe

# 安装前端依赖
npm install

# 安装后端依赖
cd server && npm install && cd ..
```

### 开发模式

```bash
# 启动前端开发服务器（端口 5173）
npm run dev

# 启动后端开发服务器（端口 8787）
cd server && npm run dev
```

### 生产部署

```bash
# 构建前后端
npm run build:all

# PM2 启动
npm run pm2:start

# 或直接运行
npm run build:all && npm start
```

应用默认运行在 `http://localhost:8787`。

#### 子路径部署（例如 `/Scribe/`）

如果通过 nginx 将项目挂载到域名子路径（例如 `http://www.flyai.cloud/Scribe/`），需要确保该子路径完整代理到 Scribe 的 PM2 服务（默认 `127.0.0.1:8787`），并且不要让 `/Scribe/*` 请求落到其它前端应用。

首页落地页支持子路径部署：截图资源使用相对路径 `hero-screenshot.jpg`，主题切换脚本会保留当前路径前缀，避免从 `/Scribe/hero-screenshot.jpg` 被改成域名根路径 `/hero-screenshot.jpg`。

部署后建议验证：

```bash
curl -I http://www.flyai.cloud/Scribe/
curl -I http://www.flyai.cloud/Scribe/hero-screenshot.jpg
curl -I http://www.flyai.cloud/Scribe/hero-screenshot-dark.jpg
```

两张截图应返回 `200`，`Content-Type` 应为 `image/jpeg`。如果请求域名根路径 `/hero-screenshot.jpg` 返回其它应用的 404，不影响 `/Scribe/` 部署；关键是页面脚本不能把图片地址切到根路径。

#### PM2 生效

代码更新后使用以下命令重新构建并重启服务：

```bash
npm run pm2:restart
pm2 status scribe
```

`scribe` 状态应为 `online`。

## AI 模型配置

Scribe 不再依赖环境变量配置模型，所有模型配置通过 Web UI 管理：

1. 打开应用 → 设置 → AI 模型管理
2. 点击「添加模型」，选择服务商并填写 API Key
3. 测试连通性后，设为默认模型
4. 所有 AI 功能将自动使用该模型

模型配置持久化在服务端 `server/data/models.json`，支持多模型切换。后端为唯一真实来源，前端不缓存模型配置；未配置激活模型时所有 AI 端点抛出明确错误，不进行静默兜底。

> 仍可通过 `server/.env.example` 配置端口和跨域来源。

## AI 能力一览

| 能力 | 入口 | 类型 |
|------|------|------|
| 续写 / 改写 / 润色 / 扩写 | 编辑器工具栏 | SSE 流式插入 ghost text |
| 全文生成 | 编辑器工具栏（弹窗输入大纲） | SSE 流式 + 1.5s 后自动角色提取 |
| 章节大纲生成 | 大纲面板 | 非流式 JSON |
| 角色对话 | 角色档案页 | SSE 流式 |
| 单条世界观构建 | 世界观条目编辑器 | SSE 流式 |
| 批量世界观构建 | 作品创建时「创建并生成世界观」按钮 | 非流式 JSON，自动入库 |
| 角色生成 | CharacterForm 顶部 AI 区 | 非流式 JSON，填入表单（不入库） |
| 角色提取 | 章节全文生成完成后自动触发 | 非流式 JSON，自动入库新角色 |

## 测试与验证

项目使用 Playwright 做端到端与 API 契约测试，默认复用本地已运行的 PM2 服务：

```bash
npm test
```

测试配置在 `playwright.config.ts`，`baseURL` 为 `http://localhost:8787`。运行测试前请先确保服务可访问：

```bash
npm run pm2:restart
curl -I http://localhost:8787/
```

关键覆盖点：

- API 路径契约：验证前端 repository 使用的 kebab-case 路径与后端路由一致。
- 认证流程：注册、登录、登出、未认证跳转。
- 作品与章节 UI 流程：创建作品、编辑章节、验证内容持久化。
- 数据隔离：验证不同用户之间作品、章节、角色、剧情、灵感、场景、世界观不可互相访问或修改。
- 落地页截图资源：验证 `hero-screenshot.jpg` / `hero-screenshot-dark.jpg` 可访问，并防止落地页脚本重新写回根路径 `'/hero-screenshot.jpg'`，保证 `/Scribe/` 子路径部署不会出现图片闪现后消失。

常用提交前检查：

```bash
npm run lint
npm run build:all
npm test
```

## 项目结构

```
Scribe/
├── src/                    # 前端源码
│   ├── components/         # 通用组件（UI / 布局 / 设置 / 反馈）
│   ├── features/           # 功能模块（编辑器 / 角色 / 世界观 / 剧情 / 场景 / 项目 / 仪表盘 / 灵感）
│   ├── pages/              # 页面路由（懒加载）
│   ├── stores/             # Zustand 状态管理（7 个 store）
│   ├── lib/                # 工具库（DB / AI 客户端 / AI 工具 / 仓库层）
│   ├── hooks/              # 自定义 Hooks（含 useDeleteWithImpact）
│   ├── utils/              # 字数统计 / 容量检测 / 日期 / className 合并
│   └── types/              # TypeScript 类型定义（含 ai.ts）
├── server/                 # 后端源码
│   └── src/
│       ├── routes/         # API 路由（ai.ts / models.ts）
│       ├── services/       # 业务服务（aiService / modelStore）
│       └── prompts/        # AI 提示词模板
├── public/                 # 静态资源（含 landing.html 落地页与 hero-screenshot*.jpg）
├── ecosystem.config.cjs    # PM2 配置
└── server/data/models.json # 模型配置持久化（运行时生成）
```

## License

[MIT](LICENSE)
