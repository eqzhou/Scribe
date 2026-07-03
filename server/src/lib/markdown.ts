// Markdown 与 HTML 互转工具
// 章节正文以 Markdown 形式持久化到文件系统，前端编辑器使用 HTML
import TurndownService from 'turndown';
import { marked } from 'marked';

// 配置 turndown：使用 atx 标题（# 风格），代码块用 fenced
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
});

// 同步 HTML 转 Markdown
export function htmlToMd(html: string): string {
  if (!html) return '';
  return turndownService.turndown(html).trim();
}

// 同步 Markdown 转 HTML
// marked.parse 默认返回 string（除非 async: true），这里同步使用
export function mdToHtml(md: string): string {
  if (!md) return '';
  // marked v5+ 默认返回 string，类型签名可能为 string | Promise<string>
  const html = marked.parse(md, { async: false });
  return typeof html === 'string' ? html : '';
}
