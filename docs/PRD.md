# Scribe PRD

## 1. 产品定位

Scribe 是面向长篇小说创作者的结构化创作系统。系统不只保存正文，而是把作品拆解为可持续维护的资料库：章节、角色、场景、世界观、剧情线、剧情节点、伏笔、灵感与写作统计。

核心原则：

- AI 先生成可审阅的小说架构，再进入正文生成。
- 模型输出必须是可校验、可入库的 JSON 结构，不依赖自由文本解析。
- 每章正文生成后，同步生成结构化副产物，持续更新作品资料库。
- 用户始终可以确认、修改、删除 AI 生成结果。

## 2. 理想创作流程

### 2.1 新建项目向导

新建项目应升级为多步向导：

1. 用户输入创意种子。
2. AI 生成小说蓝图。
3. 用户选择架构深度：简版 / 标准 / 详细。
4. 用户确认或修改蓝图。
5. 确认后写入项目资料库。
6. 进入编辑器，按章节生成正文。
7. 每章生成后自动同步角色、剧情、场景、伏笔与世界观关键点。

### 2.2 用户最小输入

向导第一步只要求最少但关键的信息：

- 题材 / 类型
- 核心设定
- 一句话故事
- 主角
- 核心冲突
- 主角目标
- 目标字数
- 风格参考
- 禁忌 / 偏好

当前实现已经支持书名、简介、类型、目标字数，并能触发 AI 项目蓝图生成；其它字段属于向导增强项。

## 3. 小说蓝图

AI 在新建项目阶段生成“小说蓝图”，不直接开写正文。蓝图应包含：

- 世界观条目
- 角色表
- 主要地点 / 场景
- 剧情主线
- 分卷 / 章节大纲
- 灵感卡片
- 伏笔清单
- 主题关键词

蓝图确认后，应批量写入：

- `chapters`
- `characters`
- `scenes`
- `plot-lines`
- `plot-points`
- `worldview`
- `inspiration`
- `foreshadowing`

当前实现已写入 `chapters`、`characters`、`scenes`、`plot-lines`、`plot-points`、`worldview`、`inspiration`。`foreshadowing`、主题关键词、分卷结构与蓝图确认 UI 尚待补齐。

## 4. 章节生成后的结构化副产物

正文生成后，系统不能只保存 `chapter.content`。每章还应提取并同步：

- 章节摘要
- 出场角色
- 发生场景
- 剧情节点
- 角色变化
- 伏笔埋设 / 回收
- 世界观新增信息
- 灵感来源

同步目标表：

- `chapters`
- `characters`
- `scenes`
- `plot-lines`
- `plot-points`
- `worldview`
- `inspiration`
- `foreshadowing`

当前实现会在全文生成后异步分析章节正文，并同步角色、场景、剧情节点、世界观与灵感。伏笔埋设 / 回收、章节摘要回写、角色变化记录仍是待补齐项。

## 5. JSON 契约

AI 输出必须使用严格 JSON。前端和服务端应拒绝不可解析结构，避免把自由文本误写入资料库。

### 5.1 项目蓝图 JSON

当前项目蓝图端点：`POST /api/ai/project-blueprint`

当前结果结构：

```json
{
  "worldview": [
    {
      "category": "geography",
      "title": "",
      "content": "",
      "tags": []
    }
  ],
  "characters": [
    {
      "name": "",
      "alias": "",
      "faction": "",
      "role": "protagonist",
      "appearance": "",
      "personality": "",
      "background": "",
      "arc": "",
      "tags": [],
      "relatedWorldviewTitles": []
    }
  ],
  "scenes": [
    {
      "name": "",
      "description": "",
      "atmosphere": [],
      "characterNames": [],
      "worldviewTitles": [],
      "chapterTitles": []
    }
  ],
  "plotLines": [
    {
      "title": "",
      "type": "main",
      "synopsis": "",
      "status": "planning",
      "order": 0
    }
  ],
  "plotPoints": [
    {
      "plotLineTitle": "",
      "title": "",
      "description": "",
      "chapterTitle": "",
      "characterNames": [],
      "order": 0,
      "timelineOrder": 0
    }
  ],
  "inspirations": [
    {
      "title": "",
      "content": "",
      "tags": [],
      "category": ""
    }
  ],
  "chapters": [
    {
      "title": "",
      "summary": "",
      "outline": "",
      "order": 0
    }
  ]
}
```

目标增强字段：

- `foreshadowing`
- `themes`
- `volumes`
- `structureLevel`
- `preferences`
- `taboos`

### 5.2 章节结构 JSON

当前章节结构端点：`POST /api/ai/chapter-architecture`

当前结果结构：

```json
{
  "characters": [
    {
      "name": "",
      "role": "",
      "appearance": "",
      "personality": "",
      "background": ""
    }
  ],
  "scenes": [
    {
      "name": "",
      "description": "",
      "atmosphere": [],
      "characterNames": [],
      "worldviewTitles": []
    }
  ],
  "plotPoints": [
    {
      "plotLineTitle": "",
      "title": "",
      "description": "",
      "characterNames": [],
      "order": 0,
      "timelineOrder": 0
    }
  ],
  "worldview": [
    {
      "category": "culture",
      "title": "",
      "content": "",
      "tags": []
    }
  ],
  "inspirations": [
    {
      "title": "",
      "content": "",
      "tags": [],
      "category": ""
    }
  ]
}
```

目标增强字段：

- `chapterSummary`
- `characterChanges`
- `foreshadowing`
- `worldviewChanges`
- `continuityWarnings`

## 6. 当前实现状态

已实现：

- 新建作品后可调用 AI 生成项目蓝图并写入资料库。
- 项目蓝图写入角色、世界观、场景、剧情线、剧情节点、灵感与章节草案。
- 全文生成完成后自动触发章节结构分析。
- 章节结构同步具备幂等保护，避免重复生成同名剧情节点和灵感。
- 已有场景会合并章节、角色和世界观关联，而不是跳过。
- AI JSON 解析支持 fenced code block 与前后说明文字的容错提取。
- Playwright 覆盖 AI 项目蓝图与章节结构端点注册检查。

待补齐：

- 新建项目多步向导 UI。
- 简版 / 标准 / 详细架构深度选择。
- 蓝图预览、确认与手动修改流程。
- 项目蓝图中的伏笔清单、主题关键词、分卷结构。
- 章节摘要、角色变化、伏笔埋设 / 回收的自动入库。
- 针对蓝图入库和章节结构同步的更细粒度回归测试。

## 7. 验收标准

### 7.1 新建项目

- 用户能用最少创意种子创建项目。
- AI 先返回结构化蓝图，不直接生成正文。
- 用户可以确认或修改蓝图。
- 确认后系统写入所有相关资料表。
- 入库过程失败时要给出明确错误，并避免产生半成品空项目。

### 7.2 章节生成

- 正文生成后，章节内容保存成功。
- 章节结构分析异步执行，不阻塞正文保存。
- 重复触发章节同步不会重复创建同名剧情节点和灵感。
- 已有场景会补齐当前章节关联。
- 伏笔、角色变化和章节摘要在目标实现中应可追踪。

### 7.3 测试

- `npm run lint` 通过。
- `npm run build:all` 通过。
- `npm test` 通过。
- E2E 保持覆盖 API 路径契约、用户隔离、认证、作品章节流程与落地页截图资源。
- 新增向导或 JSON 契约字段时，需要同步更新本 PRD、类型定义、prompt、入库逻辑和测试。
