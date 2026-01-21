// Утилиты для работы с московским временем (UTC+3)
// Все даты на платформе отображаются и вычисляются в МСК

const MSK_OFFSET = 3; // UTC+3

/**
 * Получить текущее время в Москве
 */
export function getMoscowNow(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + MSK_OFFSET * 3600000);
}

/**
 * Получить сегодняшнюю дату в Москве (начало дня)
 */
export function getMoscowToday(): Date {
  const msk = getMoscowNow();
  msk.setHours(0, 0, 0, 0);
  return msk;
}

/**
 * Конвертировать UTC дату в московское время для отображения
 */
export function toMoscowTime(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + MSK_OFFSET * 3600000);
}

/**
 * Форматировать время из ISO строки в HH:mm по МСК
 */
export function formatTimeMSK(isoString: string): string {
  const msk = toMoscowTime(isoString);
  const hours = msk.getHours().toString().padStart(2, '0');
  const minutes = msk.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Проверить, является ли дата сегодняшним днём по МСК
 */
export function isTodayMSK(date: Date): boolean {
  const today = getMoscowToday();
  const check = new Date(date);
  check.setHours(0, 0, 0, 0);
  return check.getTime() === today.getTime();
}

/**
 * Проверить, прошла ли дата по МСК
 */
export function isPastMSK(date: Date): boolean {
  const today = getMoscowToday();
  const check = new Date(date);
  check.setHours(0, 0, 0, 0);
  return check < today;
}
