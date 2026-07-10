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

/**
 * 批量世界观构建：基于书籍元信息一次性生成 6 大分类的世界观条目。
 *
 * 用于作品创建时一键生成初始世界观。输出 JSON 数组，每个元素：
 * {category, title, content, tags}，category 取值 geography/history/faction/system/culture/item。
 */
export function buildWorldviewBatchMessages(
  bookTitle: string,
  synopsis: string,
  genre: string
): ChatMessage[] {
  const system =
    '你是专业小说世界观架构师。根据书籍信息一次性为 6 大分类（地理/历史/阵营/体系/文化/物品）各生成 1 个核心世界观条目。输出 JSON 数组，每个元素形如 {"category":"","title":"","content":"","tags":[]}，category 必须是 geography/history/faction/system/culture/item 之一，content 为 200-400 字的详细设定，tags 为 2-4 个关键词。只输出 JSON，不要解释，不要包裹在代码块中。';
  const user = `【书籍信息】
书名：${bookTitle}
类型：${genre}
简介：${synopsis}

请为该书生成 6 个世界观条目（每个分类一个）。`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * 项目蓝图：新建作品时一次性生成可入库的小说架构。
 */
export function buildProjectBlueprintMessages(
  bookTitle: string,
  subtitle: string | undefined,
  synopsis: string,
  genre: string,
  targetWords: number
): ChatMessage[] {
  const system =
    '你是资深小说架构师。根据用户的新书信息生成可直接入库的项目蓝图。只输出严格 JSON 对象，不要解释，不要代码块。字段必须包含 worldview、characters、scenes、plotLines、plotPoints、inspirations、foreshadowing、chapters。worldview 生成 6 条，category 只能是 geography/history/faction/system/culture/item；characters 生成 4-8 个，role 只能是 protagonist/supporting/antagonist/minor；scenes 生成 6-10 个；plotLines 生成 1-3 条，type 只能是 main/sub，status 用 planning；plotPoints 生成 8-16 个并用 plotLineTitle 关联剧情线；inspirations 生成 6-10 张；foreshadowing 生成 4-8 条，使用 setupChapterTitle/payoffChapterTitle 关联 chapters 中的标题；chapters 生成 8-16 个章节草案。所有字符串使用中文，内容具体、有故事钩子，避免空泛。';
  const user = `【书名】${bookTitle}
【副标题】${subtitle ?? '无'}
【类型】${genre}
【目标字数】${targetWords}
【用户输入的故事种子/简介】
${synopsis}

请输出如下 JSON 结构：
{
  "worldview":[{"category":"","title":"","content":"","tags":[]}],
  "characters":[{"name":"","alias":"","faction":"","role":"","appearance":"","personality":"","background":"","arc":"","tags":[],"relatedWorldviewTitles":[]}],
  "scenes":[{"name":"","description":"","atmosphere":[],"characterNames":[],"worldviewTitles":[],"chapterTitles":[]}],
  "plotLines":[{"title":"","type":"main","synopsis":"","status":"planning","order":0}],
  "plotPoints":[{"plotLineTitle":"","title":"","description":"","chapterTitle":"","characterNames":[],"order":0,"timelineOrder":0}],
  "inspirations":[{"title":"","content":"","tags":[],"category":""}],
  "foreshadowing":[{"title":"","description":"","setupChapterTitle":"","payoffChapterTitle":"","status":"pending"}],
  "chapters":[{"title":"","summary":"","outline":"","order":0}]
}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * 章节结构分析：正文生成后提取本章副产物。
 */
export function buildChapterArchitectureMessages(
  chapterTitle: string,
  chapterContent: string,
  context: AIContext,
  existingCharacters: Array<{ name: string; alias?: string }>,
  existingScenes: Array<{ name: string }>,
  existingWorldview: Array<{ title: string }>,
  existingPlotLines: Array<{ title: string }>,
  existingForeshadowing: Array<{ title: string; status: string }>,
): ChatMessage[] {
  const system =
    '你是小说资料库整理助手。请从单章正文中提取结构化副产物，用于写入章节摘要、角色、场景、剧情节点、世界观、灵感和伏笔。只输出严格 JSON 对象，不要解释，不要代码块。characters 只输出已有角色列表之外的新角色；scenes 只输出已有场景列表之外的新场景；worldview 只输出本章新增或明显扩展的设定；plotPoints 输出 1-4 个本章推进的剧情节点；inspirations 输出 1-3 个可复用创意卡；foreshadowing 只输出本章明确埋设或回收的伏笔，action 只能为 plant 或 payoff。';
  const existingCharacterText = existingCharacters.length
    ? existingCharacters.map((c) => `- ${c.name}${c.alias ? `（${c.alias}）` : ''}`).join('\n')
    : '无';
  const existingSceneText = existingScenes.length
    ? existingScenes.map((s) => `- ${s.name}`).join('\n')
    : '无';
  const existingWorldviewText = existingWorldview.length
    ? existingWorldview.map((w) => `- ${w.title}`).join('\n')
    : '无';
  const existingPlotLineText = existingPlotLines.length
    ? existingPlotLines.map((p) => `- ${p.title}`).join('\n')
    : '无';
  const existingForeshadowingText = existingForeshadowing.length
    ? existingForeshadowing.map((f) => `- ${f.title}（${f.status}）`).join('\n')
    : '无';
  const user = `【书籍信息】
书名：${context.bookTitle}
简介：${context.synopsis}

【已有角色】
${existingCharacterText}

【已有场景】
${existingSceneText}

【已有世界观】
${existingWorldviewText}

【已有剧情线】
${existingPlotLineText}

【已有伏笔】
${existingForeshadowingText}

【章节标题】
${chapterTitle}

【章节正文】
${chapterContent}

请输出如下 JSON 结构：
{
  "chapterSummary":"",
  "characters":[{"name":"","role":"supporting","appearance":"","personality":"","background":""}],
  "scenes":[{"name":"","description":"","atmosphere":[],"characterNames":[],"worldviewTitles":[]}],
  "plotPoints":[{"plotLineTitle":"","title":"","description":"","characterNames":[],"order":0,"timelineOrder":0}],
  "worldview":[{"category":"culture","title":"","content":"","tags":[]}],
  "inspirations":[{"title":"","content":"","tags":[],"category":""}],
  "foreshadowing":[{"title":"","description":"","action":"plant"}]
}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * 角色生成：基于用户 prompt 与书籍上下文生成单个角色档案。
 *
 * 输出 JSON 对象，字段对齐 Character 表结构：
 * {name, alias, faction, role, appearance, personality, background, arc, tags}
 */
export function buildCharacterGenerateMessages(
  prompt: string,
  bookTitle: string,
  synopsis: string,
  genre: string,
  existingCharacters: Array<{ name: string; role: string }>
): ChatMessage[] {
  const system =
    '你是专业小说角色设计师。根据用户 prompt 与书籍信息生成一个角色档案。输出 JSON 对象 {"name":"","alias":"","faction":"","role":"","appearance":"","personality":"","background":"","arc":"","tags":[]}，role 必须是 protagonist/supporting/antagonist/minor 之一，appearance/personality/background/arc 各 80-200 字，tags 为 2-5 个关键词。只输出 JSON，不要解释，不要包裹在代码块中。';
  const existingPart =
    existingCharacters && existingCharacters.length > 0
      ? existingCharacters.map((c) => `- ${c.name}（${c.role}）`).join('\n')
      : '无';
  const user = `【书籍信息】
书名：${bookTitle}
类型：${genre}
简介：${synopsis}

【已有角色】
${existingPart}

【用户需求】
${prompt}

请生成一个角色档案 JSON。`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * 角色提取：从章节正文提取未入库的角色。
 *
 * 输出 JSON 数组，每个元素 {name, role, appearance, personality, background}。
 * 由前端比对已有角色，仅入库新角色。
 */
export function buildCharacterExtractMessages(
  chapterTitle: string,
  chapterContent: string,
  existingCharacters: Array<{ name: string; alias?: string }>
): ChatMessage[] {
  const system =
    '你是小说角色提取助手。从章节正文中识别登场人物，排除已有角色，输出新角色档案。输出 JSON 数组，每个元素 {"name":"","role":"","appearance":"","personality":"","background":""}，role 必须是 protagonist/supporting/antagonist/minor 之一，appearance/personality/background 各 50-150 字。若章节中无新角色，输出空数组 []。只输出 JSON，不要解释，不要包裹在代码块中。';
  const existingPart =
    existingCharacters && existingCharacters.length > 0
      ? existingCharacters.map((c) => `- ${c.name}${c.alias ? `（${c.alias}）` : ''}`).join('\n')
      : '无';
  const user = `【章节标题】${chapterTitle}

【已有角色（请排除）】
${existingPart}

【章节正文】
${chapterContent}

请提取章节中未在已有列表中的新角色，输出 JSON 数组。`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
