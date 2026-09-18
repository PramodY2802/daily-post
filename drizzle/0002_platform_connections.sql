CREATE TABLE IF NOT EXISTS platform_connections (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  tokens text NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'connected',
  external_id text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS oauth_sessions (
  state text PRIMARY KEY,
  browser_hash text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  verifier text NOT NULL,
  expires_at timestamptz NOT NULL
);
