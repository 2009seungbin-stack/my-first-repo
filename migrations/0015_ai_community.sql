-- AI 창작 커뮤니티 (owner decision 2026-10-11, nerulio-handoff/AI-COMMUNITY-CONTRACT.md §5, docs/AI-COMMUNITY.md):
-- seven new boards, and posts that carry a recipe (a prompt + in-browser processing steps anyone can replay on
-- their own image) and remixes of it.
-- Additive only: no table is rebuilt, no row is deleted. The 2026-09-29 channels (games sub hw ai studio) stay,
-- off the channel bar and read-only (platform/channels.js); every existing post, comment, vote, flag and image
-- keeps its address and data.

-- New boards, in bar order; 자유 and 공지 move behind them (공지 joins the bar).
INSERT OR IGNORE INTO channels (id, vertical, sort, in_bar, post_seq, created_at) VALUES
  ('pfp', NULL, 1, 1, 0, 0),
  ('sticker', NULL, 2, 1, 0, 0),
  ('pixel', NULL, 3, 1, 0, 0),
  ('wall', NULL, 4, 1, 0, 0),
  ('howto', NULL, 5, 1, 0, 0);
UPDATE channels SET sort = 6, in_bar = 1 WHERE id = 'free';
UPDATE channels SET sort = 7, in_bar = 1 WHERE id = 'notice';
UPDATE channels SET sort = 10 + sort, in_bar = 0 WHERE id IN ('ai', 'games', 'hw', 'studio', 'sub') AND sort < 10;

-- The hidden placeholder entity of each new board (a post without tags points at it; never shown).
INSERT OR IGNORE INTO entities (id, vertical, type, slug, names, status, index_state, created_at, updated_at) VALUES
  ('channel:pfp', 'tools', 'channel', '-channel-pfp', '{"ko":"프사·프로필","en":"Profile pictures"}', 'hidden', 'noindex', 0, 0),
  ('channel:sticker', 'tools', 'channel', '-channel-sticker', '{"ko":"이모티콘·스티커","en":"Emoji & stickers"}', 'hidden', 'noindex', 0, 0),
  ('channel:pixel', 'tools', 'channel', '-channel-pixel', '{"ko":"도트","en":"Pixel art"}', 'hidden', 'noindex', 0, 0),
  ('channel:wall', 'tools', 'channel', '-channel-wall', '{"ko":"배경화면","en":"Wallpapers"}', 'hidden', 'noindex', 0, 0),
  ('channel:howto', 'tools', 'channel', '-channel-howto', '{"ko":"레시피 질문","en":"Recipe Q&A"}', 'hidden', 'noindex', 0, 0);

-- Recipes and remixes on posts. recipe_json is validated by platform/recipe.js validateRecipe() before it is
-- stored (NULL = no recipe). remix_count and try_count are maintained by server/platform/api.js (remix_count is
-- recounted from the published children whenever one is written, hidden, restored or deleted).
ALTER TABLE discussions ADD COLUMN recipe_json TEXT;
ALTER TABLE discussions ADD COLUMN remix_of TEXT REFERENCES discussions(id) ON DELETE SET NULL;
ALTER TABLE discussions ADD COLUMN remix_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE discussions ADD COLUMN try_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE discussions ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0 CHECK (ai_generated IN (0, 1));
ALTER TABLE discussions ADD COLUMN generator TEXT;           -- chatgpt | gemini | midjourney | sd | novelai | other
ALTER TABLE discussions ADD COLUMN prompt TEXT;              -- ≤ 2000 characters (checked by the API)
-- When the writer ticked "전연령 · 실존 인물은 본인/허락받은 성인" (required with images): the declaration
-- kept as evidence for as long as the post exists (research/AI-COMMUNITY-LEGAL.md §4.4).
ALTER TABLE discussions ADD COLUMN consent_at INTEGER;

-- 레시피 모음 (most tried, newest), a post's 리믹스 grid.
CREATE INDEX discussions_recipes_tries ON discussions (status, try_count, created_at) WHERE recipe_json IS NOT NULL;
CREATE INDEX discussions_recipes_new ON discussions (status, created_at) WHERE recipe_json IS NOT NULL;
CREATE INDEX discussions_remix ON discussions (remix_of, status, created_at) WHERE remix_of IS NOT NULL;

-- "내 이미지로 해보기" per recipe per day (KST), for 이번 주 유행 (tries in the last 7 days). One count per
-- network per recipe per day (anon_counters holds that guard); no visitor data is stored here.
CREATE TABLE recipe_try_days (
  discussion_id TEXT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  day TEXT NOT NULL,                         -- YYYY-MM-DD, Korean time
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (discussion_id, day)
) WITHOUT ROWID;
CREATE INDEX recipe_try_days_day ON recipe_try_days (day);
