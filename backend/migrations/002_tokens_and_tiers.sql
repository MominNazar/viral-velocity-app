-- Token balance + tiered subscription plans (wireframe SB-*)

ALTER TABLE users ADD COLUMN token_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN plan_tier TEXT;
ALTER TABLE users ADD COLUMN billing_cycle TEXT;

ALTER TABLE subscriptions ADD COLUMN plan_tier TEXT;
ALTER TABLE subscriptions ADD COLUMN billing_cycle TEXT;
ALTER TABLE subscriptions ADD COLUMN tokens_granted INTEGER;

-- Demo-friendly starting balance for existing accounts
UPDATE users SET token_balance = 1855 WHERE token_balance = 0;
