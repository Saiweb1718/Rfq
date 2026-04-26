import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const CreateRFQSchema = z.object({
  name: z.string().min(1, 'RFQ name is required'),
  referenceId: z.string().min(1, 'Reference ID is required'),
  pickupDate: z.string().min(1, 'Pickup date is required'),
  bidStartTime: z.string().min(1, 'Bid start time is required'),
  bidCloseTime: z.string().min(1, 'Bid close time is required'),
  forcedCloseTime: z.string().min(1, 'Forced close time is required'),
  triggerWindowMinutes: z.number().int().positive(),
  extensionDurationMinutes: z.number().int().positive(),
  extensionTriggerType: z.enum(['BID_RECEIVED', 'ANY_RANK_CHANGE', 'L1_RANK_CHANGE']),
});

router.post('/', authMiddleware, validate(CreateRFQSchema), async (req, res) => {
  if (req.user.role !== 'buyer') return res.status(403).json({ error: 'Only buyers can create RFQs' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, referenceId, pickupDate, bidStartTime, bidCloseTime, forcedCloseTime,
            triggerWindowMinutes, extensionDurationMinutes, extensionTriggerType } = req.body;

    const { rows: [rfq] } = await client.query(
      `INSERT INTO rfqs (reference_id, name, pickup_date, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [referenceId, name, pickupDate, req.user.id]
    );

    const { rows: [auction] } = await client.query(
      `INSERT INTO auctions (rfq_id, bid_start_time, bid_close_time, forced_close_time,
          trigger_window_minutes, extension_duration_minutes, extension_trigger_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [rfq.id, bidStartTime, bidCloseTime, forcedCloseTime,
       triggerWindowMinutes, extensionDurationMinutes, extensionTriggerType]
    );

    await client.query('COMMIT');
    res.status(201).json({ rfq, auction });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505' && err.constraint?.includes('reference_id')) {
      return res.status(409).json({ error: 'Reference ID already exists' });
    }
    console.error('[rfqs/create]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, a.id AS auction_id, a.status AS auction_status,
              a.bid_start_time, a.bid_close_time, a.forced_close_time
       FROM rfqs r LEFT JOIN auctions a ON a.rfq_id = r.id
       WHERE r.created_by = $1 ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[rfqs/list]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
