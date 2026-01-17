import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import pool from './db';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import scheduleRoutes from './routes/schedule';
import bookingRoutes from './routes/bookings';
// Initialize Telegram bot and cron jobs
import './utils/telegram';
import './utils/cron';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api', scheduleRoutes);
app.use('/api', bookingRoutes);

// Basic health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', db_time: result.rows[0].now });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
