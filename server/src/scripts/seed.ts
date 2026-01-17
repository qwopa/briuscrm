import bcrypt from 'bcrypt';
import { query } from '../db';
import dotenv from 'dotenv';
import pool from '../db';

dotenv.config();

const generateLinkCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const seed = async () => {
  try {
    console.log('Seeding database...');
    
    // Clear existing data (optional, be careful in prod)
    // await query('DELETE FROM users');

    const adminPassword = await bcrypt.hash('admin', 10);
    const specialistPassword = await bcrypt.hash('password123', 10);

    // Create Admin
    const adminCheck = await query("SELECT id FROM users WHERE email = 'admin@brius.consult'");
    if (adminCheck.rows.length === 0) {
      await query(
        `INSERT INTO users (email, password_hash, role, name, bio, timezone)
         VALUES ($1, $2, 'admin', 'Super Admin', 'System Administrator', 'UTC')`,
        ['admin@brius.consult', adminPassword]
      );
      console.log('Admin created: admin@brius.consult / admin');
    }

    // Create Specialist
    const specCheck = await query("SELECT id FROM users WHERE email = 'jane@example.com'");
    let specialistId;
    if (specCheck.rows.length === 0) {
      const linkCode = generateLinkCode();
      const specRes = await query(
        `INSERT INTO users (email, password_hash, role, name, bio, photo_url, timezone, tg_link_code)
         VALUES ($1, $2, 'specialist', 'Jane Doe', 'Senior React Developer and Mentor', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200', 'UTC', $3)
         RETURNING id`,
        ['jane@example.com', specialistPassword, linkCode]
      );
      specialistId = specRes.rows[0].id;
      console.log(`Specialist created: jane@example.com / password123 (TG Code: ${linkCode})`);
    } else {
        specialistId = specCheck.rows[0].id;
        // Generate link code if missing
        await query(
          `UPDATE users SET tg_link_code = $1 WHERE id = $2 AND tg_link_code IS NULL`,
          [generateLinkCode(), specialistId]
        );
    }

    // Seed Schedules for Jane Doe (Weekdays 9-5)
    // 1 = Monday, 5 = Friday
    for (let day = 1; day <= 5; day++) {
        await query(
            `INSERT INTO schedules (specialist_id, day_of_week, start_time, end_time, is_active)
             VALUES ($1, $2, '09:00', '17:00', true)
             ON CONFLICT (specialist_id, day_of_week) DO NOTHING`,
            [specialistId, day]
        );
    }
    console.log('Schedules created for Jane Doe');

    
    console.log('Seeding completed');
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    pool.end();
  }
};

seed();
