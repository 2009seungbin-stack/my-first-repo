-- Origin of content, for the SEO content gate (platform/seo.js): only ORIGINAL content makes a page indexable.
-- entities.description_src: {"en":"collected","ko":"collected"} marks the locales whose description was
--   generated from collected data (e.g. the Steam-store sentence). A locale that is absent was written by an
--   editor or moderator. Written by platform/ingest.js (collector mode, or a seed entity's description_origin).
-- changes.origin: which ingest mode produced the change ('seed'|'collector'|'admin'|'community'). Rows that
--   existed before this column count as 'collector': a history page earns indexing from editorial changes.
ALTER TABLE entities ADD COLUMN description_src TEXT NOT NULL DEFAULT '{}';
ALTER TABLE changes ADD COLUMN origin TEXT NOT NULL DEFAULT 'collector';
-- Descriptions composed by collectors before this column existed.
UPDATE entities SET description_src='{"en":"collected","ko":"collected"}' WHERE id LIKE 'game:steam-%' OR id LIKE 'driver:nvidia-dc-%';
