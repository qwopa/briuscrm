import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { query } from '../db';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;

export const bot = token && token !== 'YOUR_BOT_TOKEN_HERE' ? new Telegraf(token) : null;

if (bot) {
  bot.start(async (ctx) => {
    const payload = (ctx as any).payload; // /start <code>
    
    if (!payload) {
      return ctx.reply('Привет! Чтобы привязать свой аккаунт, напишите /start <ваш_код_из_панели>.');
    }

    try {
      const result = await query(
        'SELECT id, name FROM users WHERE tg_link_code = $1',
        [payload.toUpperCase()]
      );

      if (result.rows.length === 0) {
        return ctx.reply('Неверный код. Пожалуйста, проверьте его в личном кабинете.');
      }

      const user = result.rows[0];
      await query(
        'UPDATE users SET telegram_chat_id = $1 WHERE id = $2',
        [ctx.from.id, user.id]
      );

      ctx.reply(`Аккаунт привязан! Привет, ${user.name}. Теперь вы будете получать уведомления о новых созвонах.`);
    } catch (error) {
      console.error('Telegram link error:', error);
      ctx.reply('Произошла ошибка при привязке аккаунта.');
    }
  });

  bot.launch().then(() => {
    console.log('Telegram bot started');
  }).catch(err => {
    console.error('Failed to start Telegram bot:', err);
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.log('Telegram bot token not provided, skipping initialization');
}

export const sendNotification = async (chatId: string | number, message: string) => {
  if (bot) {
    try {
      await bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Failed to send Telegram notification:', error);
    }
  }
};

export const notifyAdmin = async (message: string) => {
  try {
    // 1. Notify the static admin chat ID from .env if it exists
    if (adminChatId && adminChatId !== 'YOUR_CHAT_ID_HERE') {
      await sendNotification(adminChatId, `<b>[ADMIN]</b> ${message}`);
    }

    // 2. Notify all admins who linked their account via the dashboard
    const admins = await query(
      "SELECT telegram_chat_id FROM users WHERE role = 'admin' AND telegram_chat_id IS NOT NULL"
    );

    for (const row of admins.rows) {
      if (row.telegram_chat_id && row.telegram_chat_id !== adminChatId) {
        await sendNotification(row.telegram_chat_id, `<b>[ADMIN]</b> ${message}`);
      }
    }
  } catch (error) {
    console.error('Error in notifyAdmin:', error);
  }
};
