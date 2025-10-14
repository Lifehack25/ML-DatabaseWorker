-- Migration: Remove notified_when_scanned column from locks table
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

CREATE TABLE locks_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lock_name TEXT NOT NULL DEFAULT 'Memory Lock',
    album_title TEXT NOT NULL DEFAULT 'Wonderful Memories',
    seal_date DATE,
    scan_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO locks_new (id, lock_name, album_title, seal_date, scan_count, created_at, user_id)
SELECT id, lock_name, album_title, seal_date, scan_count, created_at, user_id
FROM locks;

DROP TABLE locks;
ALTER TABLE locks_new RENAME TO locks;

CREATE INDEX idx_locks_user_id ON locks(user_id);

COMMIT;
PRAGMA foreign_keys=ON;
