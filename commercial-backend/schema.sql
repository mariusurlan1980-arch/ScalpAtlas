CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  free_analyses_used INTEGER NOT NULL DEFAULT 0 CHECK (free_analyses_used BETWEEN 0 AND 5),
  subscription_active BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_product_id TEXT,
  subscription_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS completed_analyses (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_analysis_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_analysis_id)
);

CREATE TABLE IF NOT EXISTS store_purchases (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  product_id TEXT NOT NULL,
  store_transaction_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  raw_status JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, store_transaction_id)
);

CREATE INDEX IF NOT EXISTS completed_analyses_user_idx ON completed_analyses(user_id);
CREATE INDEX IF NOT EXISTS store_purchases_user_idx ON store_purchases(user_id);
