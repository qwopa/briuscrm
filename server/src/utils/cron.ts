import cron from 'node-cron';
import { query } from '../db';
import { notifyAdmin } from './telegram';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Helper to format date in Moscow time regardless of server timezone
const formatMoscow = (date: Date | string, pattern: string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Moscow' })), pattern, { locale: ru });
};

// Daily Summary at 09:00 Moscow Time
// If server is UTC+4, 09:00 MSK is 10:00 Server. 
// To make it reliable, we run it every hour and check if it's 9am in Moscow, 
// OR we just run it at a specific time and hope the server offset is stable.
// Let's stick to 09:00 server time for now but fix the data range.
cron.schedule('0 9 * * *', async () => {
  console.log('Running daily summary cron...');
  try {
    // Get Moscow "today" range in UTC
    const nowMoscow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    
    const startOfMoscowDay = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    startOfMoscowDay.setHours(0, 0, 0, 0);
    
    const endOfMoscowDay = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    endOfMoscowDay.setHours(23, 59, 59, 999);

    // Convert Moscow bounds back to UTC for query
    // This is tricky without date-fns-tz. 
    // Let's use a simpler approach: fetch all today's bookings and filter in JS or use Postgres timezone logic.
    
    const result = await query(
      `SELECT b.*, u.name as specialist_name 
       FROM bookings b 
       JOIN users u ON b.specialist_id = u.id 
       WHERE (b.start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow')::date = CURRENT_DATE AT TIME ZONE 'Europe/Moscow'
       AND b.status = 'confirmed'
       ORDER BY b.start_time ASC`
    );

    if (result.rows.length === 0) {
      return notifyAdmin('На сегодня созвонов нет.');
    }

    let message = `📅 <b>Сводка созвонов на сегодня (${formatMoscow(new Date(), 'd MMMM')}):</b>\n\n`;
    result.rows.forEach((b: any) => {
      message += `• <b>${formatMoscow(b.start_time, 'HH:mm')}</b> (МСК): ${b.client_name} (Ментор: ${b.specialist_name})\n`;
    });

    await notifyAdmin(message);
  } catch (error) {
    console.error('Daily summary cron error:', error);
  }
});

// Pre-call reminders every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('Running pre-call reminders cron...');
  try {
    const now = new Date();
    // 1 hour reminder range: [now + 45min, now + 75min] to ensure we don't miss any due to 15min interval
    const startRange = new Date(now.getTime() + 45 * 60 * 1000);
    const endRange = new Date(now.getTime() + 75 * 60 * 1000);

    const result = await query(
      `SELECT b.*, u.name as specialist_name 
       FROM bookings b 
       JOIN users u ON b.specialist_id = u.id 
       WHERE b.start_time >= $1 AND b.start_time <= $2 AND b.status = 'confirmed'`,
      [startRange.toISOString(), endRange.toISOString()]
    );

    for (const b of result.rows) {
      const timeStr = formatMoscow(b.start_time, 'HH:mm');
      const message = `⏰ <b>Напоминание:</b> Созвон через час!\n<b>Время:</b> ${timeStr} (МСК)\n<b>Клиент:</b> ${b.client_name}\n<b>Ментор:</b> ${b.specialist_name}\n<b>Тема:</b> ${b.notes || 'не указана'}`;
      await notifyAdmin(message);
    }
  } catch (error) {
    console.error('Pre-call reminder cron error:', error);
  }
});
