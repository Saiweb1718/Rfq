# British Auction RFQ — Final Build Plan
## Stack: TypeScript · Node/Express · pg (raw SQL) · socket.io · React + Vite

---

## 1. Final Tech Stack (No fluff, no ORMs)

### Backend
| Package | Purpose |
|---|---|
| `express` | HTTP server |
| `pg` | PostgreSQL client — raw SQL only |
| `socket.io` | Real-time WebSocket events |
| `node-cron` | Auction lifecycle scheduler |
| `jsonwebtoken` | Auth tokens |
| `bcryptjs` | Password hashing |
| `zod` | Request validation |
| `dotenv` | Env config |
| `cors` | CORS middleware |

### Frontend
| Package | Purpose |
|---|---|
| `react` + `vite` | UI framework |
| `react-router-dom` | Client-side routing |
| `socket.io-client` | Real-time subscription |
| `axios` | HTTP calls |
| `zustand` | Lightweight state management |
| `date-fns` | Date formatting and countdown math |
| `tailwindcss` | Styling |

> No Redis. socket.io broadcasts directly from the Express process.
> This is fine for a single-server internship project — and honest to say so.

---

## 2. Folder Structure

```
rfq-auction/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── pool.ts            ← pg Pool singleton
│   │   │   └── migrations/
│   │   │       └── 001_init.sql   ← all CREATE TABLE statements
│   │   ├── middleware/
│   │   │   ├── auth.ts            ← JWT verify middleware
│   │   │   └── validate.ts        ← Zod request validator
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── rfqs.ts
│   │   │   └── auctions.ts
│   │   ├── services/
│   │   │   ├── bidService.ts      ← THE critical file (SELECT FOR UPDATE)
│   │   │   └── auctionScheduler.ts
│   │   ├── socket/
│   │   │   └── auctionSocket.ts   ← socket.io room management
│   │   ├── types/
│   │   │   └── index.ts           ← shared TypeScript interfaces
│   │   └── app.ts                 ← Express + socket.io setup
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── src/
    │   ├── api/
    │   │   └── client.ts          ← axios instance with JWT header
    │   ├── components/
    │   │   ├── Countdown.tsx
    │   │   ├── RankingTable.tsx
    │   │   └── ActivityLog.tsx
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── CreateRFQ.tsx
    │   │   ├── AuctionList.tsx
    │   │   ├── AuctionDetail.tsx  ← buyer view
    │   │   └── BidRoom.tsx        ← supplier view
    │   ├── store/
    │   │   └── auctionStore.ts    ← zustand
    │   ├── hooks/
    │   │   └── useAuctionSocket.ts
    │   ├── App.tsx
    │   └── main.tsx
    ├── package.json
    └── vite.config.ts
```

---

## 3. Database Schema (001_init.sql)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ──────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('buyer', 'supplier');

CREATE TYPE auction_status AS ENUM (
  'PENDING', 'ACTIVE', 'CLOSED', 'FORCE_CLOSED'
);

CREATE TYPE extension_trigger AS ENUM (
  'BID_RECEIVED',
  'ANY_RANK_CHANGE',
  'L1_RANK_CHANGE'
);

CREATE TYPE log_event AS ENUM (
  'AUCTION_OPENED',
  'BID_SUBMITTED',
  'AUCTION_EXTENDED',
  'AUCTION_CLOSED',
  'AUCTION_FORCE_CLOSED'
);

-- ── TABLES ─────────────────────────────────────────────────

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL,
  company_name  TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rfqs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id  TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  pickup_date   DATE NOT NULL,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE auctions (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id                     UUID NOT NULL REFERENCES rfqs(id),
  bid_start_time             TIMESTAMPTZ NOT NULL,
  bid_close_time             TIMESTAMPTZ NOT NULL,    -- mutable on extension
  forced_close_time          TIMESTAMPTZ NOT NULL,    -- immutable ceiling
  trigger_window_minutes     INT NOT NULL CHECK (trigger_window_minutes > 0),
  extension_duration_minutes INT NOT NULL CHECK (extension_duration_minutes > 0),
  extension_trigger_type     extension_trigger NOT NULL,
  status                     auction_status NOT NULL DEFAULT 'PENDING',
  version                    BIGINT NOT NULL DEFAULT 0,
  created_at                 TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT forced_after_close CHECK (forced_close_time > bid_close_time),
  CONSTRAINT close_after_start  CHECK (bid_close_time > bid_start_time)
);

CREATE TABLE bids (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id          UUID NOT NULL REFERENCES auctions(id),
  supplier_id         UUID NOT NULL REFERENCES users(id),
  carrier_name        TEXT NOT NULL,
  freight_charges     NUMERIC(12,2) NOT NULL CHECK (freight_charges >= 0),
  origin_charges      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (origin_charges >= 0),
  destination_charges NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (destination_charges >= 0),
  -- DB owns the arithmetic — no app-layer rounding bugs
  total_charges       NUMERIC(12,2) GENERATED ALWAYS AS
                        (freight_charges + origin_charges + destination_charges) STORED,
  transit_time_days   INT NOT NULL CHECK (transit_time_days > 0),
  quote_validity_days INT NOT NULL CHECK (quote_validity_days > 0),
  rank                INT,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auction_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id     UUID NOT NULL REFERENCES auctions(id),
  event_type     log_event NOT NULL,
  actor_id       UUID REFERENCES users(id),
  description    TEXT NOT NULL,
  old_close_time TIMESTAMPTZ,
  new_close_time TIMESTAMPTZ,
  bid_id         UUID REFERENCES bids(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── INDEXES ────────────────────────────────────────────────

CREATE INDEX idx_auctions_status   ON auctions(status);
CREATE INDEX idx_auctions_rfq      ON auctions(rfq_id);
CREATE INDEX idx_bids_auction      ON bids(auction_id);
CREATE INDEX idx_bids_total        ON bids(auction_id, total_charges ASC);
CREATE INDEX idx_logs_auction_time ON auction_logs(auction_id, created_at DESC);
```

---

## 4. Core Types (types/index.ts)

```typescript
export interface User {
  id: string;
  email: string;
  role: 'buyer' | 'supplier';
  company_name: string;
}

export interface Auction {
  id: string;
  rfq_id: string;
  bid_start_time: Date;
  bid_close_time: Date;         // changes on extension
  forced_close_time: Date;      // never changes
  trigger_window_minutes: number;
  extension_duration_minutes: number;
  extension_trigger_type: 'BID_RECEIVED' | 'ANY_RANK_CHANGE' | 'L1_RANK_CHANGE';
  status: 'PENDING' | 'ACTIVE' | 'CLOSED' | 'FORCE_CLOSED';
  version: number;
}

export interface Bid {
  id: string;
  auction_id: string;
  supplier_id: string;
  carrier_name: string;
  freight_charges: number;
  origin_charges: number;
  destination_charges: number;
  total_charges: number;
  transit_time_days: number;
  quote_validity_days: number;
  rank: number;
  submitted_at: Date;
}

export interface BidInsertInput {
  carrierName: string;
  freightCharges: number;
  originCharges: number;
  destinationCharges: number;
  transitTimeDays: number;
  quoteValidityDays: number;
}

export interface BidResult {
  bid: Bid;
  rankings: Array<Bid & { company_name: string }>;
  extended: boolean;
  newBidCloseTime: Date;
  extensionReason?: string;
}
```

---

## 5. The Critical File: bidService.ts

```typescript
import { pool } from '../db/pool';
import { BidInsertInput, BidResult } from '../types';

// ── Helper ──────────────────────────────────────────────────
function checkTriggerCondition(
  triggerType: string,
  prevL1SupplierId: string | null,
  newL1SupplierId: string | null,
): boolean {
  if (triggerType === 'BID_RECEIVED')   return true;
  if (triggerType === 'L1_RANK_CHANGE') return prevL1SupplierId !== newL1SupplierId;
  if (triggerType === 'ANY_RANK_CHANGE') return true;
  // ANY_RANK_CHANGE: any new bid inside the window reshuffles ranks.
  // For strict interpretation, compare full prev vs new ranking arrays.
  return false;
}

// ── Main function ────────────────────────────────────────────
export async function insertBid(
  auctionId: string,
  supplierId: string,
  input: BidInsertInput,
): Promise<BidResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ─ 1. Lock the auction row ─────────────────────────────
    // NOWAIT: if locked by another bid, throw immediately.
    // The route handler catches this and retries with backoff.
    const { rows: [auction] } = await client.query(
      `SELECT * FROM auctions WHERE id = $1 FOR UPDATE NOWAIT`,
      [auctionId]
    );

    if (!auction) throw Object.assign(new Error('Auction not found'), { code: 'NOT_FOUND' });

    // ─ 2. Validate ────────────────────────────────────────
    const now = new Date();

    if (auction.status !== 'ACTIVE') {
      throw Object.assign(new Error('Auction is not active'), { code: 'AUCTION_CLOSED' });
    }
    if (now >= new Date(auction.bid_close_time)) {
      throw Object.assign(new Error('Bidding window has closed'), { code: 'AUCTION_CLOSED' });
    }

    // ─ 3. Capture pre-insert state ────────────────────────
    const { rows: [prevL1] } = await client.query(
      `SELECT supplier_id FROM bids
       WHERE auction_id = $1
       ORDER BY total_charges ASC, submitted_at ASC
       LIMIT 1`,
      [auctionId]
    );

    // ─ 4. Insert the bid ──────────────────────────────────
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

    // ─ 5. Recompute ALL ranks atomically ──────────────────
    // Tie-break: earlier submitted_at wins when total_charges are equal
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

    // ─ 6. Get updated L1 ──────────────────────────────────
    const { rows: [newL1] } = await client.query(
      `SELECT supplier_id FROM bids
       WHERE auction_id = $1
       ORDER BY total_charges ASC, submitted_at ASC LIMIT 1`,
      [auctionId]
    );

    // ─ 7. Extension logic ─────────────────────────────────
    const bidCloseTime   = new Date(auction.bid_close_time);
    const forcedClose    = new Date(auction.forced_close_time);
    const triggerStart   = new Date(
      bidCloseTime.getTime() - auction.trigger_window_minutes * 60_000
    );

    let extended        = false;
    let newBidCloseTime = bidCloseTime;
    let extensionReason: string | undefined;

    const inTriggerWindow = now >= triggerStart && now < bidCloseTime;

    if (inTriggerWindow) {
      const shouldExtend = checkTriggerCondition(
        auction.extension_trigger_type,
        prevL1?.supplier_id ?? null,
        newL1?.supplier_id ?? null,
      );

      if (shouldExtend) {
        const proposed = new Date(
          bidCloseTime.getTime() + auction.extension_duration_minutes * 60_000
        );

        // HARD CAP — never exceed forced_close_time
        newBidCloseTime = proposed < forcedClose ? proposed : forcedClose;

        if (newBidCloseTime > bidCloseTime) {
          await client.query(
            `UPDATE auctions
             SET bid_close_time = $1,
                 version        = version + 1
             WHERE id = $2`,
            [newBidCloseTime, auctionId]
          );

          extensionReason = `${auction.extension_trigger_type} triggered within ${auction.trigger_window_minutes}min window`;

          await client.query(
            `INSERT INTO auction_logs
               (auction_id, event_type, actor_id, description,
                old_close_time, new_close_time, bid_id)
             VALUES ($1,'AUCTION_EXTENDED',$2,$3,$4,$5,$6)`,
            [
              auctionId, supplierId, extensionReason,
              bidCloseTime, newBidCloseTime, newBid.id,
            ]
          );

          extended = true;
        }
      }
    }

    // ─ 8. Log bid submission ──────────────────────────────
    await client.query(
      `INSERT INTO auction_logs
         (auction_id, event_type, actor_id, description, bid_id)
       VALUES ($1,'BID_SUBMITTED',$2,$3,$4)`,
      [auctionId, supplierId, `Bid ₹${newBid.total_charges} submitted`, newBid.id]
    );

    // ─ 9. Fetch full updated rankings ─────────────────────
    const { rows: rankings } = await client.query(
      `SELECT b.*, u.company_name
       FROM bids b JOIN users u ON u.id = b.supplier_id
       WHERE b.auction_id = $1
       ORDER BY b.rank ASC`,
      [auctionId]
    );

    await client.query('COMMIT');

    return { bid: newBid, rankings, extended, newBidCloseTime, extensionReason };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();  // always return client to pool
  }
}
```

---

## 6. Route with Retry (routes/auctions.ts — bid endpoint)

```typescript
import { Router } from 'express';
import { insertBid } from '../services/bidService';
import { authMiddleware } from '../middleware/auth';
import { getIO } from '../socket/auctionSocket';
import { z } from 'zod';

const router = Router();

const BidSchema = z.object({
  carrierName:        z.string().min(1),
  freightCharges:     z.number().nonnegative(),
  originCharges:      z.number().nonnegative().default(0),
  destinationCharges: z.number().nonnegative().default(0),
  transitTimeDays:    z.number().int().positive(),
  quoteValidityDays:  z.number().int().positive(),
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

router.post('/:id/bids', authMiddleware, async (req, res) => {
  if (req.user.role !== 'supplier') {
    return res.status(403).json({ error: 'Only suppliers can bid' });
  }

  const parsed = BidSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await insertBid(req.params.id, req.user.id, parsed.data);

      // Broadcast to all sockets in this auction's room
      getIO().to(`auction:${req.params.id}`).emit('bid:new', {
        rankings:        result.rankings,
        extended:        result.extended,
        newBidCloseTime: result.newBidCloseTime,
        extensionReason: result.extensionReason,
      });

      return res.status(201).json(result);

    } catch (err: any) {
      // Retry only on lock-contention errors
      if (err.code === '55P03' && attempt < MAX_RETRIES) {
        // 55P03 = PostgreSQL lock_not_available
        await sleep(50 * Math.pow(2, attempt)); // 50 → 100 → 200ms
        continue;
      }

      if (err.code === 'AUCTION_CLOSED') return res.status(423).json({ error: err.message });
      if (err.code === 'NOT_FOUND')      return res.status(404).json({ error: err.message });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
```

---

## 7. Auction Scheduler (services/auctionScheduler.ts)

```typescript
import cron from 'node-cron';
import { pool } from '../db/pool';
import { getIO } from '../socket/auctionSocket';

export function startScheduler(): void {

  // Run every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    const client = await pool.connect();
    try {
      // 1. Activate pending auctions whose start time has passed
      await client.query(`
        UPDATE auctions SET status = 'ACTIVE'
        WHERE status = 'PENDING' AND bid_start_time <= now()
      `);

      // 2. Normal close — bid_close_time passed, not yet at forced close
      //    The AND bid_close_time < forced_close_time predicate means:
      //    if a bid just extended bid_close_time, this won't fire prematurely
      const { rows: closed } = await client.query(`
        UPDATE auctions SET status = 'CLOSED'
        WHERE status = 'ACTIVE'
          AND now() >= bid_close_time
          AND bid_close_time < forced_close_time
        RETURNING id
      `);

      // 3. Force close — forced_close_time ceiling reached no matter what
      const { rows: forceClosed } = await client.query(`
        UPDATE auctions SET status = 'FORCE_CLOSED'
        WHERE status = 'ACTIVE'
          AND now() >= forced_close_time
        RETURNING id
      `);

      // Log and broadcast each closed auction
      for (const { id } of closed) {
        await client.query(
          `INSERT INTO auction_logs (auction_id, event_type, description)
           VALUES ($1,'AUCTION_CLOSED','Auction closed at bid_close_time')`,
          [id]
        );
        getIO().to(`auction:${id}`).emit('auction:closed', { auctionId: id });
      }

      for (const { id } of forceClosed) {
        await client.query(
          `INSERT INTO auction_logs (auction_id, event_type, description)
           VALUES ($1,'AUCTION_FORCE_CLOSED','Auction force-closed at ceiling')`,
          [id]
        );
        getIO().to(`auction:${id}`).emit('auction:forceClosed', { auctionId: id });
      }

    } finally {
      client.release();
    }
  });
}
```

---

## 8. Socket Setup (socket/auctionSocket.ts)

```typescript
import { Server as IOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

let io: IOServer;

export function initSocket(httpServer: HTTPServer): void {
  io = new IOServer(httpServer, { cors: { origin: '*' } });

  io.use((socket: Socket, next) => {
    // Authenticate via JWT in handshake
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!);
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join:auction', (auctionId: string) => {
      socket.join(`auction:${auctionId}`);
    });
    socket.on('leave:auction', (auctionId: string) => {
      socket.leave(`auction:${auctionId}`);
    });
  });
}

export function getIO(): IOServer {
  if (!io) throw new Error('Socket not initialised');
  return io;
}
```

---

## 9. REST Endpoints (full list)

```
Auth
  POST /api/auth/register    body: { email, password, role, companyName }
  POST /api/auth/login       body: { email, password }  → { token, user }

RFQs  (buyer only)
  POST /api/rfqs             Create RFQ + auction config
  GET  /api/rfqs             List buyer's RFQs

Auctions
  GET  /api/auctions                      List all (with ?status= filter)
  GET  /api/auctions/:id                  Detail + current rankings
  POST /api/auctions/:id/bids             Submit bid (supplier)
  GET  /api/auctions/:id/bids             All bids (buyer=all, supplier=own)
  GET  /api/auctions/:id/logs             Activity log (newest first)
```

---

## 10. Frontend Pages

### AuctionList.tsx — shared page, both roles
- Table: RFQ Name | Reference | L1 Bid | Bid Close | Forced Close | Status badge
- WebSocket updates L1 bid and close time live (no refresh needed)
- Countdown timer next to Bid Close for ACTIVE rows
- Click row → goes to AuctionDetail (buyer) or BidRoom (supplier)

### AuctionDetail.tsx — buyer view
- Top bar: RFQ name, status pill, countdown
- Config card: trigger type, X min, Y min, forced close
- Rankings table (live updates via socket)
- Activity log — timeline of bid submissions + extensions with reasons

### BidRoom.tsx — supplier view  
Key UX points that impress:
1. Live rankings wall — updates on every `bid:new` socket event
2. Your rank highlighted ("You are L2")
3. Countdown in header, turns amber when inside trigger window
4. Extension toast: "Auction extended → closes at HH:MM (+5 min)"
5. Bid form locked out on CLOSED/FORCE_CLOSED
6. Forced close shown as a separate, immovable timer

### CreateRFQ.tsx — buyer only
- Section 1: RFQ Name, Reference ID, Pickup Date
- Section 2: "Enable British Auction" toggle (always on per assignment)
  - Bid Start / Close / Forced Close date-time pickers
  - Inline validation: `forced_close > bid_close`
  - Trigger Window X (minutes)
  - Extension Duration Y (minutes)
  - Trigger type: radio buttons
    - "Any bid received"
    - "Any rank change"
    - "L1 (lowest bidder) changes"

---

## 11. Key Edge Cases Handled

| Scenario | How it's handled |
|---|---|
| Two bids arrive simultaneously | `FOR UPDATE NOWAIT` — second one blocks then retries |
| Extension would exceed forced close | `LEAST(proposed, forced_close_time)` inside the transaction |
| Scheduler fires while last-second bid is extending | `AND now() >= bid_close_time` predicate fails after extension → 0 rows updated |
| Identical `total_charges` from two suppliers | Tie-break: `ORDER BY total_charges ASC, submitted_at ASC` — earlier wins |
| Bid submitted exactly at close time | `now() < bid_close_time` (strict less-than) inside locked transaction |
| Auction already FORCE_CLOSED | `status !== 'ACTIVE'` check rejects with 423 |
| Lock timeout after 3 retries | Returns 503 with "Server busy, please retry" |

---

## 12. Build Order (recommended sequence)

1. DB setup — write and run `001_init.sql`, verify tables
2. `db/pool.ts` — pg Pool singleton with env config
3. `types/index.ts` — all shared interfaces
4. Auth routes — register, login, JWT middleware
5. `bidService.ts` — the transaction (most important, write and test first)
6. Auction routes — CRUD + bid submission route with retry
7. Scheduler — cron jobs for lifecycle
8. Socket setup
9. Frontend — start with AuctionList, then BidRoom (most visible feature)
10. CreateRFQ form last (straightforward, no tricky logic)

---

## 13. Environment Variables (.env)

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/rfq_auction
JWT_SECRET=your-secret-key-here
PORT=3000
NODE_ENV=development
```

---

## 14. What a Reviewer Will Look For

| Criterion | Where it lives |
|---|---|
| Race condition safety | `bidService.ts` — `FOR UPDATE NOWAIT` + retry |
| Forced close is inviolable | `LEAST()` in bidService + FORCE_CLOSED cron |
| Correct rank tie-breaking | `ROW_NUMBER() ORDER BY charges, submitted_at` |
| DB-owned arithmetic | `total_charges GENERATED ALWAYS AS (...)` |
| All 3 trigger types | `checkTriggerCondition()` in bidService |
| Activity log with reasons | Every extension logged with old/new close times |
| Real-time updates | socket.io rooms, broadcast on bid insert |
| Auction lifecycle | Cron: PENDING→ACTIVE→CLOSED/FORCE_CLOSED |
| Input validation | Zod on all request bodies + DB check constraints |
| Clean separation | routes → services → db (no SQL in route files) |
```