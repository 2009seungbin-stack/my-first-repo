-- Member passkeys (docs/CLOUDFLARE.md "고정닉(패스키) 가입"): a member signs up with a nickname and a
-- passkey (fingerprint / face / device PIN), no e-mail and no provider account. The account is a normal
-- users row (provider 'passkey', provider_subject = the WebAuthn user handle) with a user_identities row
-- ('passkey', handle) and a user_profiles row (role 'user').
-- Kept apart from admin_credentials on purpose: the admin app reads admin_credentials only, so a member
-- passkey can never sign anyone in to the admin app.
CREATE TABLE member_credentials (
  id TEXT PRIMARY KEY,                       -- credential id (base64url)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,                  -- COSE_Key (base64url), as the authenticator sent it
  alg INTEGER NOT NULL CHECK (alg IN (-7, -257)),   -- ES256 | RS256
  sign_count INTEGER NOT NULL DEFAULT 0,
  transports TEXT NOT NULL DEFAULT '[]',
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX member_credentials_user ON member_credentials (user_id);
