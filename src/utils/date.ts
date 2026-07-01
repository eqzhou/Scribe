/**
 * 日期时间工具函数
 *
 * 提供格式化、热力图日期序列与相对时间等能力。
 * 所有格式化函数基于本地时区。
 */

/** 将 0~9 的数字补零为两位字符串 */
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * 格式化时间戳为 "YYYY-MM-DD"。
 *
 * @param timestamp Unix 毫秒时间戳
 */
export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 格式化时间戳为 "HH:MM"（24 小时制）。
 *
 * @param timestamp Unix 毫秒时间戳
 */
export function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 格式化时间戳为 "YYYY-MM-DD HH:MM"。
 *
 * @param timestamp Unix 毫秒时间戳
 */
export function formatDateTime(timestamp: number): string {
  return `${formatDate(timestamp)} ${formatTime(timestamp)}`;
}

/**
 * 格式化时间戳为中文简写 "X月X日"。
 *
 * @param timestamp Unix 毫秒时间戳
 */
export function formatDateChinese(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 返回今天的日期字符串（YYYY-MM-DD）。
 */
export function todayDate(): string {
  return formatDate(Date.now());
}

/**
 * 返回最近 days 天的日期数组（YYYY-MM-DD），从最早到最近排列。
 *
 * 用于热力图横轴：getHeatmapDates(7) 返回 [6 天前, ..., 今天] 共 7 项。
 *
 * @param days 天数
 */
export function getHeatmapDates(days: number): string[] {
  const result: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 从最早到最近：days-1 天前 → 今天
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    result.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }
  return result;
}

/**
 * 返回相对当前时间的简短描述。
 *
 * 规则：
 *   - < 1 分钟 → "刚刚"
 *   - < 60 分钟 → "X 分钟前"
 *   - < 24 小时 → "X 小时前"
 *   - 1 天前 → "昨日"
 *   - > 1 天 → "X 天前"
 *
 * @param timestamp Unix 毫秒时间戳
 */
export function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '昨日';
  return `${days} 天前`;
}
