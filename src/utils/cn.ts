/**
 * className 合并工具
 *
 * 简易实现（不引入 clsx）：过滤掉 false / null / undefined 后用空格拼接。
 * 支持条件式写法：cn('a', cond && 'b', undefined) → "a b" 或 "a"
 */

/** 类名候选值的类型：字符串或可被过滤的假值 */
type ClassValue = string | false | null | undefined;

/**
 * 合并类名，过滤假值。
 *
 * @param classes 类名候选值
 * @returns 用空格拼接的类名字符串
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
