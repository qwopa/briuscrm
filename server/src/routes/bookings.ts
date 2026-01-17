import express from 'express';
import { query } from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { sendNotification, notifyAdmin } from '../utils/telegram';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const router = express.Router();

interface AuthRequest extends express.Request {
    user?: {
        id: number;
        role: 'admin' | 'specialist';
    };
}

// Public: Create Booking
router.post('/bookings', async (req, res) => {
    const { specialist_id, client_name, client_email, start_time, notes } = req.body;

    if (!specialist_id || !client_name || !client_email || !start_time) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        // Calculate end time (assuming 1 hour slots as per logic)
        const startDate = new Date(start_time);
        const endDate = new Date(startDate);
        endDate.setHours(startDate.getHours() + 1);

        // Check availability (Double check to prevent race conditions roughly, though DB constraint helps)
        const conflictCheck = await query(
            `SELECT id FROM bookings 
             WHERE specialist_id = $1 
             AND start_time = $2 
             AND status != 'cancelled'`,
            [specialist_id, start_time] // Assumes exact match on slot start
        );

        if (conflictCheck.rows.length > 0) {
            return res.status(409).json({ message: 'Slot already booked' });
        }

        const result = await query(
            `INSERT INTO bookings (specialist_id, client_name, client_email, start_time, end_time, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [specialist_id, client_name, client_email, startDate.toISOString(), endDate.toISOString(), notes]
        );

        const booking = result.rows[0];

        // Helper to format date in Moscow time regardless of server timezone
        const formatMoscow = (date: Date | string, pattern: string) => {
            const d = typeof date === 'string' ? new Date(date) : date;
            return format(new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Moscow' })), pattern, { locale: ru });
        };

        // Fetch specialist info for notifications
        const specialistResult = await query(
            'SELECT name, telegram_chat_id FROM users WHERE id = $1',
            [specialist_id]
        );
        const specialist = specialistResult.rows[0];
        const formattedDate = formatMoscow(startDate, "d MMMM 'в' HH:mm");

        // Notify Specialist via Telegram
        if (specialist?.telegram_chat_id) {
            const specialistMsg = `🔔 <b>Новый созвон!</b>\n\n📅 <b>Дата:</b> ${formattedDate} (МСК)\n👤 <b>Клиент:</b> ${client_name}\n📝 <b>Тема:</b> ${notes || 'не указана'}`;
            await sendNotification(specialist.telegram_chat_id, specialistMsg);
        }

        // Notify Admin via Telegram
        const adminMsg = `📌 <b>Новая запись</b>\n\n<b>Ментор:</b> ${specialist?.name || 'Unknown'}\n<b>Дата:</b> ${formattedDate} (МСК)\n<b>Клиент:</b> ${client_name}\n<b>Тема:</b> ${notes || 'не указана'}`;
        await notifyAdmin(adminMsg);

        res.status(201).json(booking);
    } catch (error: any) {
        console.error('Error creating booking:', error);
        // Catch unique constraint violation if race condition slipped through
        if (error.code === '23505') { 
            return res.status(409).json({ message: 'Slot already booked' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// Protected: Get My Bookings (Specialist)
router.get('/my/bookings', authenticateToken, async (req, res) => {
    const userId = (req as AuthRequest).user!.id;
    try {
        const result = await query(
            `SELECT b.*, u.name as specialist_name, u.email as specialist_email 
             FROM bookings b
             JOIN users u ON b.specialist_id = u.id
             WHERE b.specialist_id = $1
             ORDER BY b.start_time ASC`,
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin: Get All Bookings
router.get('/admin/bookings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await query(
            `SELECT b.*, s.name as specialist_name 
             FROM bookings b
             JOIN users s ON b.specialist_id = s.id
             ORDER BY b.start_time DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all bookings:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Protected: Update Booking Status
router.put('/bookings/:id/status', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const user = (req as AuthRequest).user!;

    if (!['confirmed', 'cancelled', 'completed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        // Check permissions: Admin or the specialist who owns the booking
        const bookingCheck = await query('SELECT specialist_id FROM bookings WHERE id = $1', [id]);
        if (bookingCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (user.role !== 'admin' && bookingCheck.rows[0].specialist_id !== user.id) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const result = await query(
            'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
