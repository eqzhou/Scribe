/**
 * ID 生成工具
 *
 * 统一封装实体 ID 生成逻辑。现代浏览器与 Node 均原生支持 crypto.randomUUID。
 */

/**
 * 生成一个符合 RFC 4122 v4 的随机唯一 ID。
 *
 * @returns UUID v4 字符串
 */
export function genId(): string {
  return crypto.randomUUID();
}
