import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { insertBid } from '../services/bidService.js';
import { getIO } from '../socket/auctionSocket.js';

const router = Router();

const BidSchema = z.object({
  carrierName:        z.string().min(1),
  freightCharges:     z.number().nonnegative(),
  originCharges:      z.number().nonnegative().default(0),
  destinationCharges: z.number().nonnegative().default(0),
  transitTimeDays:    z.number().int().positive(),
  quoteValidityDays:  z.number().int().positive(),
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

router.get('/', authMiddleware, async (req, res) => {
  try {
    const statusFilter = req.query.status;
    let query = `
      SELECT a.*, r.name AS rfq_name, r.reference_id AS rfq_reference_id,
             (SELECT b.total_charges FROM bids b WHERE b.auction_id = a.id ORDER BY b.total_charges ASC LIMIT 1) AS l1_bid
      FROM auctions a JOIN rfqs r ON r.id = a.rfq_id
    `;
    const params = [];
    if (statusFilter) { query += ` WHERE a.status = $1`; params.push(statusFilter); }
    query += ` ORDER BY a.created_at DESC`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[auctions/list]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows: [auction] } = await pool.query(
      `SELECT a.*, r.name AS rfq_name, r.reference_id AS rfq_reference_id, r.pickup_date
       FROM auctions a JOIN rfqs r ON r.id = a.rfq_id WHERE a.id = $1`,
      [req.params.id]
    );
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    const { rows: rankings } = await pool.query(
      `SELECT b.*, u.company_name FROM bids b JOIN users u ON u.id = b.supplier_id
       WHERE b.auction_id = $1 ORDER BY b.rank ASC`,
      [req.params.id]
    );
    res.json({ auction, rankings });
  } catch (err) {
    console.error('[auctions/detail]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/bids', authMiddleware, validate(BidSchema), async (req, res) => {
  if (req.user.role !== 'supplier') return res.status(403).json({ error: 'Only suppliers can bid' });
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await insertBid(req.params.id, req.user.id, req.body);
      getIO().to(`auction:${req.params.id}`).emit('bid:new', {
        rankings: result.rankings, extended: result.extended,
        newBidCloseTime: result.newBidCloseTime, extensionReason: result.extensionReason,
      });
      return res.status(201).json(result);
    } catch (err) {
      if (err.code === '55P03' && attempt < MAX_RETRIES) { await sleep(50 * Math.pow(2, attempt)); continue; }
      if (err.code === 'AUCTION_CLOSED') return res.status(423).json({ error: err.message });
      if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
      if (err.code === '23514') return res.status(409).json({ error: 'Auction has reached its maximum extension limit' });
      console.error('[auctions/bid]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  res.status(503).json({ error: 'Server busy, please retry' });
});

router.get('/:id/bids', authMiddleware, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'buyer') {
      query = `SELECT b.*, u.company_name FROM bids b JOIN users u ON u.id = b.supplier_id WHERE b.auction_id = $1 ORDER BY b.rank ASC`;
      params = [req.params.id];
    } else {
      query = `SELECT b.*, u.company_name FROM bids b JOIN users u ON u.id = b.supplier_id WHERE b.auction_id = $1 AND b.supplier_id = $2 ORDER BY b.submitted_at DESC`;
      params = [req.params.id, req.user.id];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[auctions/bids]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/logs', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT al.*, u.company_name AS actor_name FROM auction_logs al
       LEFT JOIN users u ON u.id = al.actor_id
       WHERE al.auction_id = $1 ORDER BY al.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[auctions/logs]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
