-- Public nicknames are unique regardless of case (docs/n2/research/CODE-REVIEW.md #2).
CREATE UNIQUE INDEX user_profiles_display_name ON user_profiles (lower(display_name));
