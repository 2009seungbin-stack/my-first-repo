-- Sign-in identities (docs/AUTH.md "로그인 수단"): one Nerulio account can have several
-- (provider, provider_subject) pairs — Google, GitHub, Discord. The pair is the only lookup key;
-- e-mail is display data and never links accounts by itself (a same-address account on another
-- provider stays a separate account until its owner links it while signed in).
-- users.provider/provider_subject (0001) stays the account's first identity, so existing reads keep working.
CREATE TABLE user_identities (
  provider TEXT NOT NULL,                    -- google | github | discord
  provider_subject TEXT NOT NULL,            -- Google sub, GitHub numeric user id, Discord snowflake
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,                                -- only an address the provider reports as verified
  display_name TEXT,                         -- provider display name (private; never shown publicly)
  handle TEXT,                               -- GitHub login / Discord username: a nickname suggestion only
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  PRIMARY KEY (provider, provider_subject)
);
CREATE INDEX user_identities_user ON user_identities (user_id);

-- Every existing OAuth account keeps signing in with the identity it was created with.
INSERT INTO user_identities (provider, provider_subject, user_id, email, display_name, handle, created_at, last_login_at)
  SELECT provider, provider_subject, id, email, display_name, NULL, created_at, NULL FROM users WHERE provider IN ('google', 'github', 'discord');
