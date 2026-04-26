import cron from 'node-cron';
import { pool } from '../db/pool.js';
import { getIO } from '../socket/auctionSocket.js';

export function startScheduler() {
  cron.schedule('*/30 * * * * *', async () => {
    const client = await pool.connect();
    try {
      const { rows: activated } = await client.query(`
        UPDATE auctions SET status = 'ACTIVE'
        WHERE status = 'PENDING' AND bid_start_time <= now() RETURNING id
      `);
      for (const { id } of activated) {
        await client.query(
          `INSERT INTO auction_logs (auction_id, event_type, description)
           VALUES ($1, 'AUCTION_OPENED', 'Auction opened by scheduler')`, [id]
        );
        getIO().to(`auction:${id}`).emit('auction:opened', { auctionId: id });
      }

      const { rows: closed } = await client.query(`
        UPDATE auctions SET status = 'CLOSED'
        WHERE status = 'ACTIVE' AND now() >= bid_close_time AND bid_close_time < forced_close_time RETURNING id
      `);

      const { rows: forceClosed } = await client.query(`
        UPDATE auctions SET status = 'FORCE_CLOSED'
        WHERE status = 'ACTIVE' AND now() >= forced_close_time RETURNING id
      `);

      for (const { id } of closed) {
        await client.query(
          `INSERT INTO auction_logs (auction_id, event_type, description)
           VALUES ($1,'AUCTION_CLOSED','Auction closed at bid_close_time')`, [id]
        );
        getIO().to(`auction:${id}`).emit('auction:closed', { auctionId: id });
      }

      for (const { id } of forceClosed) {
        await client.query(
          `INSERT INTO auction_logs (auction_id, event_type, description)
           VALUES ($1,'AUCTION_FORCE_CLOSED','Auction force-closed at ceiling')`, [id]
        );
        getIO().to(`auction:${id}`).emit('auction:forceClosed', { auctionId: id });
      }
    } catch (err) {
      console.error('[scheduler] Error in cron job:', err);
    } finally {
      client.release();
    }
  });

  console.log('[scheduler] Auction lifecycle cron started (every 30s)');
}
