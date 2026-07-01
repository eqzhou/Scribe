// 上下文类型定义：书籍 + 角色 + 世界观
export interface AIContext {
  bookTitle: string;
  synopsis: string;
  characters: Array<{ name: string; role: string; personality: string }>;
  worldview: Array<{ title: string; content: string }>;
}

// OpenAI 兼容接口的消息结构
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 格式化角色卡
function formatCharacters(characters: AIContext['characters']): string {
  if (!characters || characters.length === 0) return '无';
  return characters
    .map((c) => `- ${c.name}（${c.role}）：${c.personality}`)
    .join('\n');
}

// 格式化世界观
function formatWorldview(worldview: AIContext['worldview']): string {
  if (!worldview || worldview.length === 0) return '无';
  return worldview.map((w) => `### ${w.title}\n${w.content}`).join('\n\n');
}

/**
 * 续写：根据前文/后文与上下文续写片段
 */
export function buildContinueMessages(
  beforeText: string,
  afterText: string,
  context: AIContext
): ChatMessage[] {
  const system =
    '你是专业小说创作助手，根据上下文续写下文。要求：风格一致、情节自然、字数 300-800 字。只输出正文，不要解释。';
  const user = `【书籍信息】
书名：${context.bookTitle}
简介：${context.synopsis}

【角色卡】
${formatCharacters(context.characters)}

【世界观】
${formatWorldview(context.worldview)}

【前文】
${beforeText}

【后文】
${afterText}

请续写连接前文与后文的片段，只输出正文。`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * 改写 / 润色 / 扩写：根据动作与风格处理文本
 */
export function buildRewriteMessages(
  text: string,
  action: 'rewrite' | 'polish' | 'expand',
  style: string | undefined,
  context: AIContext
): ChatMessage[] {
  const actionMap: Record<'rewrite' | 'polish' | 'expand', string> = {
    rewrite: '改写：在保留原意的基础上重新组织语言与结构',
    polish: '润色：优化遣词造句，提升表达质感，不改变核心内容',
    expand: '扩写：在原意基础上丰富细节、扩展篇幅',
  };
  const stylePart = style ? `风格定调：${style}。` : '';
  const system = `你是专业小说创作助手，对给定文本进行${actionMap[action]}。${stylePart}要求：贴合原作设定，字数适中。只输出正文，不要解释。`;
  const user = `【书籍信息】
书名：${context.bookTitle}
简介：${context.synopsis}

【角色卡】
${formatCharacters(context.characters)}

【世界观】
${formatWorldview(context.worldview)}

【待处理文本】
${text}

请输出处理后的文本，只输出正文。`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * 章节大纲：输出 JSON 数组 [{title, summary, keyEvents:[]}]
 */
export function buildOutlineMessages(
  plotPoints: Array<{ title: string; description: string }>,
  characters: AIContext['characters'],
  worldview: AIContext['worldview'],
  chapterCount: number
): ChatMessage[] {
  const system =
    '你是专业小说大纲策划助手。根据给定的情节点、角色与世界观，生成章节大纲。输出 JSON 数组，每个元素形如 {"title":"","summary":"","keyEvents":[]}，keyEvents 为字符串数组。只输出 JSON，不要解释，不要包裹在代码块中。';
  const plotPart = plotPoints
    .map((p) => `- ${p.title}：${p.description}`)
    .join('\n');
  const user = `【情节点】
${plotPart}

【角色卡】
${formatCharacters(characters)}

【世界观】
${formatWorldview(worldview)}

【章节数】${chapterCount}

请生成 ${chapterCount} 个章节的大纲 JSON 数组。`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * 全文生成：根据大纲生成整章正文（3000-5000 字）
 */
export function buildFulltextMessages(
  chapterTitle: string,
  outline: string,
  context: AIContext
): ChatMessage[] {
  const system =
    '你是专业小说创作助手。根据章节大纲生成整章正文，3000-5000 字。要求：情节连贯、人物生动、风格统一。只输出正文，不要解释。';
  const user = `【书籍信息】
书名：${context.bookTitle}
简介：${context.synopsis}

【角色卡】
${formatCharacters(context.characters)}

【世界观】
${formatWorldview(context.worldview)}

【章节标题】
${chapterTitle}

【章节大纲】
${outline}

请生成整章正文。`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * 角色对话：生成符合角色性格的对话
 */
export function buildDialogueMessages(
  character: { name: string; personality: string; background: string },
  scene: string,
  topic: string,
  otherCharacters: Array<{ name: string; personality: string }>
): ChatMessage[] {
  const system =
    '你是专业小说对话编写助手。生成符合角色性格的对话。要求：语气贴合人设、推动情节、自然生动。只输出对话正文，不要解释。';
  const othersPart =
    otherCharacters && otherCharacters.length > 0
      ? otherCharacters.map((c) => `- ${c.name}：${c.personality}`).join('\n')
      : '无';
  const user = `【主角色】
姓名：${character.name}
性格：${character.personality}
背景：${character.background}

【场景】
${scene}

【话题】
${topic}

【其他角色】
${othersPart}

请生成对话，只输出对话正文。`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * 世界观条目：输出 JSON {title, content}
 */
export function buildWorldviewMessages(
  category: string,
  topic: string,
  existing: Array<{ title: string; content: string }>
): ChatMessage[] {
  const system =
    '你是专业世界观设定助手。根据分类与主题扩展世界观条目。输出 JSON 对象 {"title":"","content":""}，content 为详细设定文本。只输出 JSON，不要解释，不要包裹在代码块中。';
  const existingPart =
    existing && existing.length > 0
      ? existing.map((e) => `- ${e.title}：${e.content}`).join('\n')
      : '无';
  const user = `【分类】${category}

【主题】${topic}

【已有条目】
${existingPart}

请生成新的世界观条目 JSON。`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
