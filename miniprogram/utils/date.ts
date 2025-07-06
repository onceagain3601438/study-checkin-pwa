/**
 * 日期处理工具类
 * 用于处理学习打卡日历相关的日期操作
 */

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param date 日期对象
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date): string;
export function formatDate(date: Date, format: string): string;
export function formatDate(date: Date, format?: string): string {
  if (!format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  return format
    .replace('YYYY', String(year))
    .replace('MM', String(month).padStart(2, '0'))
    .replace('DD', String(day).padStart(2, '0'));
}

/**
 * 获取日期字符串
 * @param date 日期对象
 * @returns 日期字符串 YYYY-MM-DD
 */
export function getDateString(date: Date): string {
  return formatDate(date);
}

/**
 * 获取今天的日期字符串
 * @returns 今天的日期字符串 YYYY-MM-DD
 */
export function getTodayString(): string {
  return formatDate(new Date());
}

/**
 * 获取昨天的日期字符串
 * @returns 昨天的日期字符串 YYYY-MM-DD
 */
export function getYesterdayString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDate(yesterday);
}

/**
 * 解析日期字符串为Date对象
 * @param dateString 日期字符串 YYYY-MM-DD
 * @returns Date对象
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * 获取指定月份的所有天数
 * @param year 年份
 * @param month 月份 (1-12)
 * @returns 天数数组
 */
export function getDaysInMonth(year: number, month: number): number[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({length: daysInMonth}, (_, i) => i + 1);
}

/**
 * 获取指定月份的第一天是星期几
 * @param year 年份
 * @param month 月份 (1-12)
 * @returns 星期几 (0-6, 0表示星期日)
 */
export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/**
 * 获取月份和年份的显示文本
 * @param year 年份
 * @param month 月份 (1-12)
 * @returns 格式化的月份年份文本
 */
export function getMonthYearText(year: number, month: number): string {
  return `${year}年${month}月`;
}

/**
 * 获取上个月的年份和月份
 * @param year 当前年份
 * @param month 当前月份 (1-12)
 * @returns 上个月的年份和月份
 */
export function getPreviousMonth(year: number, month: number): {year: number, month: number} {
  if (month === 1) {
    return {year: year - 1, month: 12};
  }
  return {year, month: month - 1};
}

/**
 * 获取下个月的年份和月份
 * @param year 当前年份
 * @param month 当前月份 (1-12)
 * @returns 下个月的年份和月份
 */
export function getNextMonth(year: number, month: number): {year: number, month: number} {
  if (month === 12) {
    return {year: year + 1, month: 1};
  }
  return {year, month: month + 1};
}

/**
 * 判断是否是今天
 * @param dateString 日期字符串 YYYY-MM-DD
 * @returns 是否是今天
 */
export function isToday(dateString: string): boolean {
  return dateString === getTodayString();
}

/**
 * 判断日期是否在今天之前
 * @param dateString 日期字符串 YYYY-MM-DD
 * @returns 是否在今天之前
 */
export function isBeforeToday(dateString: string): boolean {
  const date = parseDate(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * 格式化时间为 HH:MM 格式
 * @param date 日期对象
 * @returns 格式化后的时间字符串
 */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
} 