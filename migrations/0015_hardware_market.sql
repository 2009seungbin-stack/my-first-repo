-- Minimal public market facts only. No post bodies, usernames, contacts or images.
CREATE TABLE IF NOT EXISTS hardware_market_items (
 id TEXT PRIMARY KEY, source TEXT NOT NULL, post_id TEXT NOT NULL, url TEXT NOT NULL,
 country TEXT NOT NULL, currency TEXT NOT NULL, model TEXT NOT NULL, capacity TEXT NOT NULL,
 price REAL NOT NULL CHECK(price > 0), shipping REAL, basis TEXT NOT NULL CHECK(basis IN ('asking','sold')),
 fingerprint TEXT NOT NULL, first_seen INTEGER NOT NULL, changed_at INTEGER NOT NULL,
 last_seen INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS hardware_market_lookup ON hardware_market_items(country,model,basis,active,last_seen);
CREATE TABLE IF NOT EXISTS hardware_market_revisions (
 item_id TEXT NOT NULL, fingerprint TEXT NOT NULL, observed_at INTEGER NOT NULL,
 price REAL NOT NULL, shipping REAL, basis TEXT NOT NULL,
 PRIMARY KEY(item_id,fingerprint,observed_at)
);
CREATE TABLE IF NOT EXISTS hardware_market_fetches (
 url TEXT PRIMARY KEY, source TEXT NOT NULL, post_id TEXT NOT NULL,
 etag TEXT, modified TEXT, checked_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS hardware_market_sources (
 source TEXT PRIMARY KEY, country TEXT NOT NULL, attempted_at INTEGER NOT NULL,
 success_at INTEGER, status TEXT NOT NULL, accepted INTEGER NOT NULL DEFAULT 0,
 excluded INTEGER NOT NULL DEFAULT 0
);
