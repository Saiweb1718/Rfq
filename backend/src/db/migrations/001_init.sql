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
  bid_close_time             TIMESTAMPTZ NOT NULL,
  forced_close_time          TIMESTAMPTZ NOT NULL,
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

-- ── DISABLE RLS (we handle auth in our own JWT layer) ─────

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs DISABLE ROW LEVEL SECURITY;
ALTER TABLE auctions DISABLE ROW LEVEL SECURITY;
ALTER TABLE bids DISABLE ROW LEVEL SECURITY;
ALTER TABLE auction_logs DISABLE ROW LEVEL SECURITY;
