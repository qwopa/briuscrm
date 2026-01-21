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
        // Calculate date range in UTC for the Moscow day
        // Moscow day starts at 00:00 MSK = 21:00 UTC previous day
        const dayStartUTC = new Date(Date.UTC(year, month - 1, day - 1, 21, 0, 0));
        const dayEndUTC = new Date(Date.UTC(year, month - 1, day, 20, 59, 59));
        
        const bookingsResult = await query(
            `SELECT start_time FROM bookings 
             WHERE specialist_id = $1 
             AND start_time >= $2
             AND start_time <= $3
             AND status != 'cancelled'`,
            [id, dayStartUTC.toISOString(), dayEndUTC.toISOString()]
        );

        // 3. Generate slots
        const startTimeStr = String(schedule.start_time).substring(0, 5);
        const endTimeStr = String(schedule.end_time).substring(0, 5);
        
        const [startH, startM] = startTimeStr.split(':').map(Number);
        const [endH, endM] = endTimeStr.split(':').map(Number);
        
        const slots = [];
        let currentH = startH;
        let currentM = startM;

        // Create a Set of booked times for faster lookup
        const bookedTimes = new Set(
            bookingsResult.rows.map((b: any) => new Date(b.start_time).getTime())
        );

        while (currentH < endH || (currentH === endH && currentM < endM)) {
            // Assume 1 hour slots
            if (currentH + 1 > endH || (currentH + 1 === endH && currentM > endM)) break;

            // Create a date object for this slot in Moscow time
            // Moscow is UTC+3. So to get UTC, subtract 3 hours.
            const slotUTC = Date.UTC(year, month - 1, day, currentH - 3, currentM);
            
            // Check if booked using Set lookup
            const isBooked = bookedTimes.has(slotUTC);

            // Only add if not booked and in the future
            if (!isBooked && slotUTC > Date.now()) {
                slots.push(new Date(slotUTC).toISOString());
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
        
        // Calculate UTC range for the entire month in Moscow time
        // Month starts at 00:00 MSK on day 1 = 21:00 UTC on previous day
        const startDateUTC = new Date(Date.UTC(y, m - 1, 0, 21, 0, 0));
        // Month ends at 23:59 MSK on last day = 20:59 UTC on last day
        const daysInMonth = new Date(y, m, 0).getDate();
        const endDateUTC = new Date(Date.UTC(y, m - 1, daysInMonth, 20, 59, 59));

        // Get specialist's schedule
        const scheduleResult = await query(
            `SELECT day_of_week, to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time 
             FROM schedules WHERE specialist_id = $1 AND is_active = true`,
            [id]
        );
        
        const activeDays = new Set(scheduleResult.rows.map(s => s.day_of_week));
        
        // Get all bookings for this month with their Moscow dates
        const bookingsResult = await query(
            `SELECT start_time FROM bookings 
             WHERE specialist_id = $1 
             AND start_time >= $2 AND start_time <= $3
             AND status != 'cancelled'`,
            [id, startDateUTC.toISOString(), endDateUTC.toISOString()]
        );

        // Count bookings per Moscow date
        const bookingCountByDate: Record<string, number> = {};
        for (const b of bookingsResult.rows) {
            const utcDate = new Date(b.start_time);
            // Convert to Moscow time
            const mskDate = new Date(utcDate.getTime() + 3 * 60 * 60 * 1000);
            const dateStr = `${mskDate.getUTCFullYear()}-${String(mskDate.getUTCMonth() + 1).padStart(2, '0')}-${String(mskDate.getUTCDate()).padStart(2, '0')}`;
            bookingCountByDate[dateStr] = (bookingCountByDate[dateStr] || 0) + 1;
        }

        const fullDays: string[] = [];
        
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

                const bookingCount = bookingCountByDate[dateStr] || 0;
                
                if (bookingCount >= totalSlots) {
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
