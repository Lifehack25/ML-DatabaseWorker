-- Sample data for development and testing
-- Run this after schema.sql to populate the database with test data

-- Sample users
INSERT INTO users (name, email, phone_number, auth_provider, provider_id, email_verified, phone_verified, has_premium_storage, created_at) VALUES
('John Doe', 'john.doe@example.com', '+1234567890', 'email', NULL, 1, 1, 0, datetime('now')),
('Jane Smith', 'jane.smith@example.com', NULL, 'google', 'google_123456', 1, 0, 1, datetime('now')),
('Bob Wilson', NULL, '+9876543210', 'phone', NULL, 0, 1, 0, datetime('now')),
('Alice Johnson', 'alice@example.com', '+1122334455', 'apple', 'apple_789012', 1, 1, 1, datetime('now'));

-- Sample locks
INSERT INTO locks (lock_name, album_title, seal_date, notified_when_scanned, scan_count, created_at, user_id) VALUES
('Wedding Lock', 'Our Beautiful Wedding', '2024-06-15', 1, 15, datetime('now', '-30 days'), 1),
('Anniversary Lock', 'Five Years Together', '2024-02-14', 1, 8, datetime('now', '-60 days'), 1),
('Family Vacation', 'Summer 2024 Memories', NULL, 1, 3, datetime('now', '-10 days'), 2),
('Baby Photos', 'Little Emma Grows Up', '2024-01-01', 0, 22, datetime('now', '-90 days'), 4);

-- Sample media objects
INSERT INTO media_objects (lock_id, cloudflare_id, url, file_name, media_type, is_main_picture, created_at, display_order) VALUES
(1, 'cf_img_001', 'https://imagedelivery.net/example1.jpg', 'wedding_ceremony.jpg', 'image/jpeg', 1, datetime('now', '-30 days'), 1),
(1, 'cf_img_002', 'https://imagedelivery.net/example2.jpg', 'first_dance.jpg', 'image/jpeg', 0, datetime('now', '-30 days'), 2),
(1, 'cf_vid_001', 'https://videodelivery.net/example1.mp4', 'wedding_vows.mp4', 'video/mp4', 0, datetime('now', '-30 days'), 3),
(2, 'cf_img_003', 'https://imagedelivery.net/example3.jpg', 'anniversary_dinner.jpg', 'image/jpeg', 1, datetime('now', '-60 days'), 1),
(3, 'cf_img_004', 'https://imagedelivery.net/example4.jpg', 'beach_sunset.jpg', 'image/jpeg', 1, datetime('now', '-10 days'), 1),
(3, 'cf_img_005', 'https://imagedelivery.net/example5.jpg', 'family_portrait.jpg', 'image/jpeg', 0, datetime('now', '-10 days'), 2),
(4, 'cf_img_006', 'https://imagedelivery.net/example6.jpg', 'baby_first_smile.jpg', 'image/jpeg', 1, datetime('now', '-90 days'), 1),
(4, 'cf_img_007', 'https://imagedelivery.net/example7.jpg', 'baby_first_steps.jpg', 'image/jpeg', 0, datetime('now', '-80 days'), 2),
(4, 'cf_vid_002', 'https://videodelivery.net/example2.mp4', 'baby_laughing.mp4', 'video/mp4', 0, datetime('now', '-70 days'), 3);