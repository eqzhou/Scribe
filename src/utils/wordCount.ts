/**
 * 字数统计工具
 *
 * 依据《技术架构文档》第 9.3 节字数统计算法实现。
 * 算法步骤：
 *   1. 剥离 HTML 标签与命名实体
 *   2. 统计中文汉字数量（CJK 基本区 + 扩展 A 区）
 *   3. 统计英文单词数量（连续字母数字序列视为一个词）
 *   4. 总字数 = 中文字数 + 英文词数
 *
 * 不计入：标点、空格、换行。
 */

/** 中日韩统一表意文字范围：基本区 U+4E00~U+9FFF + 扩展 A 区 U+3400~U+4DBF */
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

/** 英文单词（含数字）正则：连续字母数字序列视为一个词 */
const WORD_REGEX = /[a-zA-Z0-9]+/g;

/**
 * 统计 HTML 富文本的字数。
 *
 * @param html 富文本 HTML 字符串
 * @returns 中文字数 + 英文词数
 */
export function countWords(html: string): number {
  // 1. 剥离 HTML 标签与常见命名实体
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

  // 2. 统计中文汉字
  const cjkMatches = text.match(CJK_REGEX) || [];
  const cjkCount = cjkMatches.length;

  // 3. 统计英文单词（含数字）
  const wordMatches = text.match(WORD_REGEX) || [];
  const wordCount = wordMatches.length;

  // 4. 总字数 = 中文字数 + 英文词数
  return cjkCount + wordCount;
}

/**
 * 将数字格式化为带千分位的字符串。
 *
 * 例如：287642 → "287,642"
 *
 * @param n 待格式化的数字
 * @returns 带千分位分隔符的字符串
 */
export function formatWordCount(n: number): string {
  // 使用正则在每三位数字前插入逗号；负数符号与小数点不受影响
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
