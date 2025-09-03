# ML-DatabaseWorker

A Cloudflare Worker with D1 Database for the Memory Locks project.

## Overview

This worker provides a fast, edge-deployed API for Memory Locks data operations using:
- **Cloudflare Workers** - Edge compute runtime
- **Hono Framework** - Express-like routing for Workers  
- **D1 Database** - SQLite at the edge with global replication
- **TypeScript** - Type safety and modern JS features

## Database Schema

The database uses snake_case naming and includes three main tables:

- **users** - User accounts with authentication data and preferences
- **locks** - Physical/digital lock records with album metadata  
- **media_objects** - Photos/videos associated with locks

All tables include proper foreign key relationships and indexes for performance.

## API Endpoints

### Health Check
- `GET /` - Worker health check

### User Management  
- `GET /users` - List all users (limit 100)
- `GET /users/:id` - Get user by ID
- `POST /users` - Create new user with default values
- `GET /users/email/:email` - Find user by email address
- `POST /users/:id/login` - Update user's last login timestamp

### Lock Management
- `GET /locks` - List all locks (limit 100, ?include_media_count=true)
- `GET /locks/:id` - Get lock by ID
- `POST /locks` - Create new lock with default values
- `PUT /locks/:id` - Update lock details
- `DELETE /locks/:id` - Delete lock (cascades to media objects)
- `POST /locks/:id/scan` - Increment scan count
- `GET /locks/user/:userId` - Get locks by user ID (?include_media_count=true)

### Media Object Management
- `GET /media-objects` - List all media objects (limit 100, ?media_type filter)
- `GET /media-objects/:id` - Get media object by ID
- `POST /media-objects` - Create new media object
- `PUT /media-objects/:id` - Update media object
- `DELETE /media-objects/:id` - Delete media object
- `GET /media-objects/lock/:lockId` - Get media objects by lock ID
- `GET /media-objects/lock/:lockId/main` - Get main picture for lock
- `DELETE /media-objects/lock/:lockId` - Delete all media for lock
- `POST /media-objects/lock/:lockId/reorder` - Reorder display order
- `GET /media-objects/lock/:lockId/count` - Count media objects for lock

### Album Views (Relationships)
- `GET /albums/:id` - Get complete album (lock + user + media)
- `GET /albums/:id/preview` - Get album preview (basic info + main picture)
- `GET /albums/user/:userId` - Get all user albums with media
- `GET /albums/recent` - Get recent albums (?include_user=true, ?limit=20)
- `GET /albums/stats` - Get overall platform statistics

### API Status
- `GET /api/status` - API health and database connection status

## Development

### Setup
```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run tests
npm run test

# Generate TypeScript types
npm run cf-typegen
```

### Environment Variables
The worker requires these Cloudflare credentials:
- `CLOUDFLARE_ACCOUNT_ID`: 4ef9556a5405665912f2bbc0bbf8a05a
- `CLOUDFLARE_API_TOKEN`: [Your API token]

### Database Operations
```bash
# Apply schema to local database
npm run db:migrate

# Apply schema to production database  
npm run db:migrate:remote

# Add sample data locally
npm run db:seed

# Add sample data to production
npm run db:seed:remote
```

## Deployment

```bash
npm run deploy
```

## Testing

Example API calls:

```bash
# Create user
curl -X POST http://localhost:8787/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'

# Create lock
curl -X POST http://localhost:8787/locks \
  -H "Content-Type: application/json" \
  -d '{"album_title": "Wedding Memories", "user_id": 1}'

# Create media object  
curl -X POST http://localhost:8787/media-objects \
  -H "Content-Type: application/json" \
  -d '{"lock_id": 1, "url": "https://example.com/photo.jpg", "media_type": "image/jpeg", "is_main_picture": true}'

# Get complete album with relationships
curl http://localhost:8787/albums/1

# Get statistics
curl http://localhost:8787/albums/stats

# Increment scan count
curl -X POST http://localhost:8787/locks/1/scan
```

## Project Structure

```
ML-DatabaseWorker/
├── src/
│   ├── routes/
│   │   └── users.ts           # User API routes
│   ├── repositories/
│   │   └── userRepository.ts  # Database access layer
│   ├── index.ts               # Main worker entry point
│   └── types.ts               # TypeScript interfaces
├── db/
│   ├── schema.sql             # Database schema
│   └── sample-data.sql        # Sample data for testing
├── test/                      # Test files
├── wrangler.jsonc            # Cloudflare Worker config
├── package.json              # Dependencies
└── tsconfig.json             # TypeScript config
```

## Integration

This worker is designed to integrate with:
- **MemoryLocksAPI** (.NET Web API) - Main application backend
- **ML-MobileApp** (.NET MAUI) - Mobile application
- **CreateLocks** (Console app) - Administrative tools

The database schema matches the .NET API models with snake_case naming for consistency with SQL conventions.