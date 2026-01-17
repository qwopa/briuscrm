import express from 'express';
import pool, { query } from '../db';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

interface AuthRequest extends express.Request {
    user?: {
        id: number;
        role: 'admin' | 'specialist';
    };
}

// Get own schedule
router.get('/my/schedule', authenticateToken, async (req, res) => {
    const userId = (req as AuthRequest).user!.id;
    try {
        const result = await query(
            `SELECT day_of_week, to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time, is_active 
             FROM schedules WHERE specialist_id = $1 ORDER BY day_of_week`,
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update own schedule
router.put('/my/schedule', authenticateToken, async (req, res) => {
    const userId = (req as AuthRequest).user!.id;
    const { schedules } = req.body; 

    if (!Array.isArray(schedules)) {
        return res.status(400).json({ message: 'Invalid schedule format' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM schedules WHERE specialist_id = $1', [userId]);

        for (const slot of schedules) {
            if (slot.is_active) {
                await client.query(
                    `INSERT INTO schedules (specialist_id, day_of_week, start_time, end_time, is_active)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [userId, slot.day_of_week, slot.start_time, slot.end_time, true]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Schedule updated' });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Error updating schedule:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    } finally {
        client.release();
    }
});

// Admin: Get specialist schedule
router.get('/admin/specialists/:id/schedule', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query(
            `SELECT day_of_week, to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time, is_active 
             FROM schedules WHERE specialist_id = $1 ORDER BY day_of_week`,
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin: Update specialist schedule
router.put('/admin/specialists/:id/schedule', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { schedules } = req.body;

    if (!Array.isArray(schedules)) {
        return res.status(400).json({ message: 'Invalid schedule format' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM schedules WHERE specialist_id = $1', [id]);

        for (const slot of schedules) {
            if (slot.is_active) {
                await client.query(
                    `INSERT INTO schedules (specialist_id, day_of_week, start_time, end_time, is_active)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [id, slot.day_of_week, slot.start_time, slot.end_time, true]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Schedule updated' });
    } catch (error: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
});

// Public: Get availability for a specific date
router.get('/specialists/:id/availability', async (req, res) => {
    const { id } = req.params;
    const { date } = req.query; // YYYY-MM-DD

    if (!date) {
        return res.status(400).json({ message: 'Date required' });
    }

    try {
        // Parse date correctly (YYYY-MM-DD format) to avoid timezone shifts
        const [year, month, day] = (date as string).split('-').map(Number);
        const targetDate = new Date(year, month - 1, day);
        const dayOfWeek = targetDate.getDay(); 

        // 1. Get schedule for this day
        const scheduleResult = await query(
            `SELECT day_of_week, to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time, is_active 
             FROM schedules WHERE specialist_id = $1 AND day_of_week = $2 AND is_active = true`,
            [id, dayOfWeek]
        );

        if (scheduleResult.rows.length === 0) {
            return res.json([]); 
        }

        const schedule = scheduleResult.rows[0];

        // 2. Get existing bookings for this day
        // Using AT TIME ZONE to handle Moscow time comparison
        const bookingsResult = await query(
            `SELECT start_time FROM bookings 
             WHERE specialist_id = $1 
             AND DATE(start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow') = $2
             AND status != 'cancelled'`,
            [id, date]
        );

        // 3. Generate slots
        const startTimeStr = String(schedule.start_time).substring(0, 5);
        const endTimeStr = String(schedule.end_time).substring(0, 5);
        
        const [startH, startM] = startTimeStr.split(':').map(Number);
        const [endH, endM] = endTimeStr.split(':').map(Number);
        
        const slots = [];
        let currentH = startH;
        let currentM = startM;

        while (currentH < endH || (currentH === endH && currentM < endM)) {
            // Assume 1 hour slots
            if (currentH + 1 > endH || (currentH + 1 === endH && currentM > endM)) break;

            // Create a date object for this slot in Moscow time
            // Moscow is UTC+3. So to get UTC, subtract 3 hours.
            const slotUTC = Date.UTC(year, month - 1, day, currentH - 3, currentM);
            const slotDate = new Date(slotUTC);
            
            // Check if booked
            const isBooked = bookingsResult.rows.some((b: any) => {
                const bDate = new Date(b.start_time);
                return bDate.getTime() === slotUTC;
            });

            // Only add if not booked and in the future
            if (!isBooked && slotUTC > Date.now()) {
                slots.push(slotDate.toISOString());
            }

            currentH += 1;
        }

        res.json(slots);
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Public: Get full days for a month
router.get('/specialists/:id/month-availability', async (req, res) => {
    const { id } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
        return res.status(400).json({ message: 'Month and year required' });
    }

    try {
        const m = parseInt(month as string);
        const y = parseInt(year as string);
        const startDate = new Date(y, m - 1, 1);
        const endDate = new Date(y, m, 0, 23, 59, 59, 999);

        // Get specialist's schedule
        const scheduleResult = await query(
            `SELECT day_of_week, to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time 
             FROM schedules WHERE specialist_id = $1 AND is_active = true`,
            [id]
        );
        
        const activeDays = new Set(scheduleResult.rows.map(s => s.day_of_week));
        
        // Get all bookings for this month
        const bookingsResult = await query(
            `SELECT DATE(start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow') as booking_date, COUNT(*) as count
             FROM bookings 
             WHERE specialist_id = $1 
             AND start_time >= $2 AND start_time <= $3
             AND status != 'cancelled'
             GROUP BY booking_date`,
            [id, startDate.toISOString(), endDate.toISOString()]
        );

        const fullDays: string[] = [];
        const daysInMonth = new Date(y, m, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(y, m - 1, day);
            const dayOfWeek = date.getDay();
            
            // Format as YYYY-MM-DD for consistency
            const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            if (!activeDays.has(dayOfWeek)) {
                fullDays.push(dateStr);
                continue;
            }

            const schedule = scheduleResult.rows.find(s => s.day_of_week === dayOfWeek);
            if (schedule) {
                const [startH] = schedule.start_time.split(':').map(Number);
                const [endH] = schedule.end_time.split(':').map(Number);
                const totalSlots = endH - startH; 

                const booking = bookingsResult.rows.find((b: any) => {
                    // b.booking_date is a Date object from pg driver, but represents midnights in local time or UTC
                    // Let's format it to YYYY-MM-DD string directly for comparison
                    const bDate = new Date(b.booking_date);
                    const y = bDate.getFullYear();
                    const m = bDate.getMonth() + 1;
                    const d = bDate.getDate();
                    const bDateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    return bDateStr === dateStr;
                });
                
                if (booking && Number(booking.count) >= totalSlots) {
                    fullDays.push(dateStr);
                }
            }
        }

        res.json(fullDays);
    } catch (error) {
        console.error('Error fetching month availability:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
