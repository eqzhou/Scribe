# Scribe — 专业小说创作系统

> A professional novel crafting system for writers worldwide.

Scribe 是一套面向小说作者的全栈创作工具，集成了项目管理、章节编辑、角色设定、世界观构建、剧情线管理、AI 辅助创作等功能。前端基于 React + TipTap 编辑器，后端提供 AI 模型管理与 OpenAI 兼容接口代理。

## 功能特性

- **作品管理** — 多作品支持，每部作品独立维护角色、世界观、剧情、场景
- **富文本编辑器** — 基于 TipTap，支持章节分卷、场景分割、角色提及、世界观引用
- **AI 辅助创作** — 续写、改写、润色、扩写、大纲生成、全文生成、角色对话、世界观构建
- **多模型管理** — 支持 OpenAI / Anthropic / DeepSeek / 通义千问 / 豆包 / 智谱 / 月之暗面及任何 OpenAI 兼容接口
- **角色系统** — 角色卡片、关系图谱、性格设定
- **世界观构建** — 分类管理（地理/历史/阵营/体系/文化/物品）、条目关联
- **剧情管理** — 剧情线、剧情节点、伏笔追踪、时间线
- **场景管理** — 场景卡片、视角切换、地点时间标注
- **写作仪表盘** — 字数统计、目标环、写作热力图、最近作品
- **灵感笔记** — 快速记录、分类标签
- **主题系统** — 多套主题（墨韵/青瓷/朱砂等）、明暗模式切换
- **数据导入导出** — 支持 JSON 格式备份与恢复

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 8 |
| 富文本编辑 | TipTap 3 |
| 状态管理 | Zustand |
| 本地数据库 | Dexie (IndexedDB) |
| 样式 | Tailwind CSS 3 |
| 动画 | Framer Motion |
| 后端 | Express + TypeScript |
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

## AI 模型配置

Scribe 不再依赖环境变量配置模型，所有模型配置通过 Web UI 管理：

1. 打开应用 → 设置 → AI 模型管理
2. 点击「添加模型」，选择服务商并填写 API Key
3. 测试连通性后，设为默认模型
4. 所有 AI 功能将自动使用该模型

模型配置持久化在服务端 `server/data/models.json`，支持多模型切换。

> 仍可通过 `server/.env.example` 配置端口和跨域来源。

## 项目结构

```
Scribe/
├── src/                    # 前端源码
│   ├── components/         # 通用组件（UI / 布局 / 设置）
│   ├── features/           # 功能模块（编辑器 / 角色 / 世界观 / 剧情 / 场景）
│   ├── pages/              # 页面路由
│   ├── stores/             # Zustand 状态管理
│   ├── lib/                # 工具库（DB / AI 客户端 / 仓库层）
│   ├── hooks/              # 自定义 Hooks
│   └── types/              # TypeScript 类型定义
├── server/                 # 后端源码
│   └── src/
│       ├── routes/         # API 路由（AI / 模型管理）
│       ├── services/       # 业务服务（AI 调用 / 模型存储）
│       └── prompts/        # AI 提示词模板
├── public/                 # 静态资源
└── ecosystem.config.cjs    # PM2 配置
```

## License

[MIT](LICENSE)
