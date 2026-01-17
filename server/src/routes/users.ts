import express from 'express';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import { query } from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'specialist-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

interface AuthRequest extends express.Request {
  user?: {
    id: number;
    role: 'admin' | 'specialist';
  };
}

const generateLinkCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Public: Get all specialists
router.get('/specialists', async (req, res) => {
  try {
    const result = await query(
      "SELECT id, name, photo_url, bio, timezone, role FROM users WHERE role = 'specialist'"
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching specialists:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public: Get specialist details
router.get('/specialists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      "SELECT id, name, photo_url, bio, timezone, role FROM users WHERE id = $1 AND role = 'specialist'",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Specialist not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching specialist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Create new specialist
router.post('/admin/specialists', authenticateToken, requireAdmin, async (req, res) => {
  const { email, password, name, bio, photo_url, timezone } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Check if email exists
    const check = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const linkCode = generateLinkCode();
    
    const result = await query(
      `INSERT INTO users (email, password_hash, role, name, bio, photo_url, timezone, tg_link_code)
       VALUES ($1, $2, 'specialist', $3, $4, $5, $6, $7)
       RETURNING id, email, name, role`,
      [email, hashedPassword, name, bio, photo_url, timezone || 'UTC', linkCode]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating specialist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Protected: Get own Telegram linking info
router.get('/my/telegram', authenticateToken, async (req, res) => {
  const userId = (req as AuthRequest).user!.id;
  
  try {
    // First check if link code exists
    let result = await query(
      'SELECT telegram_chat_id, tg_link_code FROM users WHERE id = $1',
      [userId]
    );

    let { telegram_chat_id, tg_link_code } = result.rows[0];

    // Generate link code if missing
    if (!tg_link_code) {
      tg_link_code = generateLinkCode();
      await query('UPDATE users SET tg_link_code = $1 WHERE id = $2', [tg_link_code, userId]);
    }

    res.json({
      linked: !!telegram_chat_id,
      linkCode: tg_link_code
    });
  } catch (error) {
    console.error('Error fetching telegram info:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Protected: Regenerate Telegram link code
router.post('/my/telegram/regenerate', authenticateToken, async (req, res) => {
  const userId = (req as AuthRequest).user!.id;
  
  try {
    const newCode = generateLinkCode();
    await query(
      'UPDATE users SET tg_link_code = $1, telegram_chat_id = NULL WHERE id = $2',
      [newCode, userId]
    );
    
    res.json({ linkCode: newCode, linked: false });
  } catch (error) {
    console.error('Error regenerating link code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Update specialist
router.put('/admin/specialists/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, bio } = req.body;

  try {
    const result = await query(
      'UPDATE users SET name = COALESCE($1, name), bio = COALESCE($2, bio) WHERE id = $3 AND role = $4 RETURNING id, name, bio',
      [name, bio, id, 'specialist']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Specialist not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating specialist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Delete specialist
router.delete('/admin/specialists/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      'DELETE FROM users WHERE id = $1 AND role = $2 RETURNING id',
      [id, 'specialist']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Specialist not found' });
    }

    res.json({ message: 'Specialist deleted' });
  } catch (error) {
    console.error('Error deleting specialist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Upload specialist photo
router.post('/admin/specialists/:id/photo', authenticateToken, requireAdmin, upload.single('photo'), async (req, res) => {
  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const photoUrl = `/uploads/${req.file.filename}`;
    const result = await query(
      'UPDATE users SET photo_url = $1 WHERE id = $2 AND role = $3 RETURNING id, photo_url',
      [photoUrl, id, 'specialist']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Specialist not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get specialist schedule
router.get('/admin/specialists/:id/schedule', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      'SELECT day_of_week, start_time::text, end_time::text, is_active FROM schedules WHERE specialist_id = $1 ORDER BY day_of_week',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Update specialist schedule
router.put('/admin/specialists/:id/schedule', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { schedules } = req.body;

  if (!Array.isArray(schedules)) {
    return res.status(400).json({ message: 'Invalid schedule format' });
  }

  const client = await import('../db').then(m => m.default.connect());
  try {
    await client.query('BEGIN');
    
    // Delete existing schedules
    await client.query('DELETE FROM schedules WHERE specialist_id = $1', [id]);

    // Insert new schedules
    for (const slot of schedules) {
      await client.query(
        `INSERT INTO schedules (specialist_id, day_of_week, start_time, end_time, is_active)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, slot.day_of_week, slot.start_time, slot.end_time, slot.is_active ?? true]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Schedule updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating schedule:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
