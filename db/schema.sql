-- Initial database schema for Memory Locks
-- Based on .NET API models with snake_case naming and default values

-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    phone_number TEXT,
    auth_provider TEXT NOT NULL DEFAULT '',
    provider_id TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    has_premium_storage BOOLEAN NOT NULL DEFAULT FALSE
);

-- Locks table
CREATE TABLE locks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lock_name TEXT NOT NULL DEFAULT 'Memory Lock',
    album_title TEXT NOT NULL DEFAULT 'Wonderful Memories',
    seal_date DATE,
    notified_when_scanned BOOLEAN NOT NULL DEFAULT TRUE,
    scan_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Media Objects table
CREATE TABLE media_objects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lock_id INTEGER NOT NULL,
    cloudflare_id TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    file_name TEXT,
    media_type TEXT NOT NULL DEFAULT '',
    is_main_picture BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    display_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (lock_id) REFERENCES locks(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_provider ON users(auth_provider, provider_id);
CREATE INDEX idx_locks_user_id ON locks(user_id);
CREATE INDEX idx_media_objects_lock_id ON media_objects(lock_id);
CREATE INDEX idx_media_objects_display_order ON media_objects(lock_id, display_order);