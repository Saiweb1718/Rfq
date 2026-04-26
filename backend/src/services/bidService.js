import { pool } from '../db/pool.js';

function checkTriggerCondition(triggerType, prevL1SupplierId, newL1SupplierId) {
  if (triggerType === 'BID_RECEIVED')    return true;
  if (triggerType === 'L1_RANK_CHANGE')  return prevL1SupplierId !== newL1SupplierId;
  if (triggerType === 'ANY_RANK_CHANGE') return true;
  return false;
}

export async function insertBid(auctionId, supplierId, input) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: [auction] } = await client.query(
      `SELECT * FROM auctions WHERE id = $1 FOR UPDATE NOWAIT`,
      [auctionId]
    );

    if (!auction) throw Object.assign(new Error('Auction not found'), { code: 'NOT_FOUND' });

    const now = new Date();

    if (auction.status !== 'ACTIVE') {
      throw Object.assign(new Error('Auction is not active'), { code: 'AUCTION_CLOSED' });
    }
    if (now >= new Date(auction.bid_close_time)) {
      throw Object.assign(new Error('Bidding window has closed'), { code: 'AUCTION_CLOSED' });
    }

    const { rows: [prevL1] } = await client.query(
      `SELECT supplier_id FROM bids
       WHERE auction_id = $1
       ORDER BY total_charges ASC, submitted_at ASC
       LIMIT 1`,
      [auctionId]
    );

    const { rows: [newBid] } = await client.query(
      `INSERT INTO bids
         (auction_id, supplier_id, carrier_name, freight_charges,
          origin_charges, destination_charges, transit_time_days, quote_validity_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        auctionId, supplierId, input.carrierName,
        input.freightCharges, input.originCharges, input.destinationCharges,
        input.transitTimeDays, input.quoteValidityDays,
      ]
    );

    await client.query(
      `UPDATE bids SET rank = sub.new_rank
       FROM (
         SELECT id,
           ROW_NUMBER() OVER (
             ORDER BY total_charges ASC, submitted_at ASC
           ) AS new_rank
         FROM bids WHERE auction_id = $1
       ) sub
       WHERE bids.id = sub.id AND bids.auction_id = $1`,
      [auctionId]
    );

    const { rows: [updatedBid] } = await client.query(
      `SELECT * FROM bids WHERE id = $1`, [newBid.id]
    );

    const { rows: [newL1] } = await client.query(
      `SELECT supplier_id FROM bids
       WHERE auction_id = $1
       ORDER BY total_charges ASC, submitted_at ASC LIMIT 1`,
      [auctionId]
    );

    const bidCloseTime = new Date(auction.bid_close_time);
    const forcedClose  = new Date(auction.forced_close_time);
    const triggerStart = new Date(
      bidCloseTime.getTime() - auction.trigger_window_minutes * 60000
    );

    let extended = false;
    let newBidCloseTime = bidCloseTime;
    let extensionReason;

    const inTriggerWindow = now >= triggerStart && now < bidCloseTime;

    if (inTriggerWindow) {
      const shouldExtend = checkTriggerCondition(
        auction.extension_trigger_type,
        prevL1?.supplier_id ?? null,
        newL1?.supplier_id ?? null,
      );

      if (shouldExtend) {
        const proposed = new Date(
          bidCloseTime.getTime() + auction.extension_duration_minutes * 60000
        );

        newBidCloseTime = proposed < forcedClose ? proposed : new Date(forcedClose.getTime() - 1000);

        if (newBidCloseTime > bidCloseTime && newBidCloseTime < forcedClose) {
          await client.query(
            `UPDATE auctions
             SET bid_close_time = $1, version = version + 1
             WHERE id = $2`,
            [newBidCloseTime, auctionId]
          );

          extensionReason = `${auction.extension_trigger_type} triggered within ${auction.trigger_window_minutes}min window`;

          await client.query(
            `INSERT INTO auction_logs
               (auction_id, event_type, actor_id, description,
                old_close_time, new_close_time, bid_id)
             VALUES ($1,'AUCTION_EXTENDED',$2,$3,$4,$5,$6)`,
            [auctionId, supplierId, extensionReason, bidCloseTime, newBidCloseTime, newBid.id]
          );

          extended = true;
        }
      }
    }

    await client.query(
      `INSERT INTO auction_logs
         (auction_id, event_type, actor_id, description, bid_id)
       VALUES ($1,'BID_SUBMITTED',$2,$3,$4)`,
      [auctionId, supplierId, `Bid ₹${newBid.total_charges} submitted`, newBid.id]
    );

    const { rows: rankings } = await client.query(
      `SELECT b.*, u.company_name
       FROM bids b JOIN users u ON u.id = b.supplier_id
       WHERE b.auction_id = $1
       ORDER BY b.rank ASC`,
      [auctionId]
    );

    await client.query('COMMIT');

    return { bid: updatedBid, rankings, extended, newBidCloseTime, extensionReason };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
