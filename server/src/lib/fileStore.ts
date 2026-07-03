// 章节正文文件存储
//
// 路径模式：file/{userId}/{bookTitle}/{chapterTitle}.md
// 所有文件名都经过严格清洗，防止路径穿越攻击。
import fs from 'node:fs';
import path from 'node:path';

// 文件根目录：项目根目录下的 file/，进程启动时自动创建
const FILE_ROOT = path.resolve(process.cwd(), 'file');

// 需要清洗的非法字符：路径分隔符与 Windows 保留字符
// 包括 / \ : * ? " < > | 以及控制字符
const ILLEGAL_CHARS = /[\/\\:*?"<>|\x00-\x1f]/g;

// 路径穿越检测：拒绝包含 .. 段的输入
const TRAVERSAL_PATTERN = /(?:^|\/|\\)\.\.(?:\/|\\|$)/;

/**
 * 清洗文件名/目录名片段：
 * - 去除路径分隔符与 Windows 保留字符
 * - trim 前后空白与点（避免 Windows 上以点结尾的文件无法访问）
 * - 拒绝路径穿越（.. 段）
 * - 长度限制为 100 字符（防止超出文件系统路径长度限制）
 * 清洗后为空字符串时抛错。
 */
function sanitizeSegment(name: string, kind: 'userId' | 'bookTitle' | 'chapterTitle'): string {
  if (typeof name !== 'string') {
    throw new Error(`${kind} 必须为字符串`);
  }
  if (TRAVERSAL_PATTERN.test(name)) {
    throw new Error(`${kind} 包含非法路径段（..）`);
  }
  const cleaned = name
    .replace(ILLEGAL_CHARS, '')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 100)
    .trim();
  if (!cleaned) {
    throw new Error(`${kind} 清洗后为空，请提供有效的名称`);
  }
  return cleaned;
}

// 拼接某章节的完整文件路径
function buildChapterPath(userId: string, bookTitle: string, chapterTitle: string): string {
  const u = sanitizeSegment(userId, 'userId');
  const b = sanitizeSegment(bookTitle, 'bookTitle');
  const c = sanitizeSegment(chapterTitle, 'chapterTitle');
  return path.join(FILE_ROOT, u, b, `${c}.md`);
}

// 拼接某作品的目录路径
function buildBookDir(userId: string, bookTitle: string): string {
  const u = sanitizeSegment(userId, 'userId');
  const b = sanitizeSegment(bookTitle, 'bookTitle');
  return path.join(FILE_ROOT, u, b);
}

// 确保目录存在
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 启动时确保文件根目录存在
ensureDir(FILE_ROOT);

/**
 * 写入章节正文（Markdown 格式）
 * 自动创建必要的目录。
 */
export function writeChapter(
  userId: string,
  bookTitle: string,
  chapterTitle: string,
  markdownContent: string,
): void {
  const filePath = buildChapterPath(userId, bookTitle, chapterTitle);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, markdownContent ?? '', 'utf-8');
}

/**
 * 读取章节正文（Markdown）。文件不存在时返回空字符串。
 */
export function readChapter(
  userId: string,
  bookTitle: string,
  chapterTitle: string,
): string {
  const filePath = buildChapterPath(userId, bookTitle, chapterTitle);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 删除单个章节文件。文件不存在时静默忽略。
 */
export function deleteChapter(
  userId: string,
  bookTitle: string,
  chapterTitle: string,
): void {
  const filePath = buildChapterPath(userId, bookTitle, chapterTitle);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * 删除整个作品目录（包含其下全部章节文件）。
 * 目录不存在时静默忽略。
 */
export function deleteBookFiles(userId: string, bookTitle: string): void {
  const dir = buildBookDir(userId, bookTitle);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 重命名单个章节文件（用于章节标题变更场景）。
 * 旧文件不存在时直接写入新文件；新文件路径已存在时会被覆盖。
 */
export function renameChapter(
  userId: string,
  bookTitle: string,
  oldTitle: string,
  newTitle: string,
): void {
  const oldPath = buildChapterPath(userId, bookTitle, oldTitle);
  const newPath = buildChapterPath(userId, bookTitle, newTitle);
  ensureDir(path.dirname(newPath));
  if (fs.existsSync(oldPath)) {
    if (fs.existsSync(newPath)) {
      fs.unlinkSync(newPath);
    }
    fs.renameSync(oldPath, newPath);
  } else {
    // 旧文件不存在时，按空内容创建新文件，保证一致性
    fs.writeFileSync(newPath, '', 'utf-8');
  }
}

/**
 * 重命名作品目录（用于作品标题变更场景）。
 * 旧目录不存在时直接创建新空目录。
 */
export function renameBook(
  userId: string,
  oldTitle: string,
  newTitle: string,
): void {
  const oldDir = buildBookDir(userId, oldTitle);
  const newDir = buildBookDir(userId, newTitle);
  ensureDir(path.dirname(newDir));
  if (fs.existsSync(oldDir)) {
    if (fs.existsSync(newDir)) {
      fs.rmSync(newDir, { recursive: true, force: true });
    }
    fs.renameSync(oldDir, newDir);
  } else {
    ensureDir(newDir);
  }
}
