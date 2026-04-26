import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['buyer', 'supplier']),
  companyName: z.string().min(1, 'Company name is required'),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(user) {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '24h' });
}

router.post('/register', validate(RegisterSchema), async (req, res) => {
  try {
    const { email, password, role, companyName } = req.body;

    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role, company_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, company_name`,
      [email, passwordHash, role, companyName]
    );

    const user = rows[0];
    const token = signToken({
      id: user.id, email: user.email,
      role: user.role, company_name: user.company_name,
    });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('[auth/register]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', validate(LoginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken({
      id: user.id, email: user.email,
      role: user.role, company_name: user.company_name,
    });

    res.json({
      token,
      user: {
        id: user.id, email: user.email,
        role: user.role, company_name: user.company_name,
      },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
