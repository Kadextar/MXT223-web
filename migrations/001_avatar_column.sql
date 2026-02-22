-- Add avatar column to students if missing (idempotent for SQLite 3.35+)
-- PostgreSQL: use IF NOT EXISTS only where supported, or run once manually.

-- SQLite (run only if column doesn't exist):
-- ALTER TABLE students ADD COLUMN avatar TEXT DEFAULT '1.png';

-- For PostgreSQL, same:
-- ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '1.png';
