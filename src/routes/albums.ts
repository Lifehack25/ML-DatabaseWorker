import { Hono } from 'hono';
import { LockRepository } from '../repositories/lockRepository';
import { MediaObjectRepository } from '../repositories/mediaObjectRepository';
import { decodeId, encodeId, isHashedId } from '../utils/hashids';

type Bindings = {
  DB: D1Database;
  HASHIDS_SALT: string;
  HASHIDS_MIN_LENGTH: string;
};

const albums = new Hono<{ Bindings: Bindings }>();

// GET /album/:identifier - Public endpoint to fetch album data
// Accepts either a hashed ID (from web) or integer ID (from mobile app)
albums.get('/:identifier', async (c) => {
  try {
    const identifier = c.req.param('identifier');

    if (!identifier) {
      return c.json({
        Success: false,
        Message: 'Lock identifier is required'
      }, 400);
    }

    const lockRepo = new LockRepository(c.env.DB);
    const mediaRepo = new MediaObjectRepository(c.env.DB);

    // Get Hashids configuration from secrets
    const salt = c.env.HASHIDS_SALT;
    const minLength = parseInt(c.env.HASHIDS_MIN_LENGTH || '6');

    // Decode the identifier (either hashed or direct integer)
    let lockId: number;
    let hashedLockId: string;

    if (isHashedId(identifier, salt, minLength)) {
      // It's a hashed ID from the web
      const decoded = decodeId(identifier, salt, minLength);
      if (decoded === null) {
        return c.json({
          Success: false,
          Message: 'Invalid hashed lock ID'
        }, 400);
      }
      lockId = decoded;
      hashedLockId = identifier;
    } else {
      // It's a direct integer ID from mobile app
      const parsedId = parseInt(identifier);
      if (isNaN(parsedId)) {
        return c.json({
          Success: false,
          Message: 'Invalid lock ID format'
        }, 400);
      }
      lockId = parsedId;
      hashedLockId = encodeId(parsedId, salt, minLength);
    }

    const lock = await lockRepo.findById(lockId);

    if (!lock) {
      return c.json({
        Success: false,
        Message: 'Album not found'
      }, 404);
    }

    // Get all media objects for this lock, ordered by display_order
    const mediaObjects = await mediaRepo.findByLockId(lockId);

    // Sort by display_order
    mediaObjects.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    // Map to MediaDto format (PascalCase)
    const mediaDtos = mediaObjects.map(media => ({
      Id: media.id,
      Type: media.media_type === 'image' ? 0 : 1, // MediaType enum: Image = 0, Video = 1
      Url: media.url,
      IsMainImage: Boolean(media.is_main_picture),
      DisplayOrder: media.display_order || 0,
      CloudflareId: media.cloudflare_id,
      // TODO: Add video duration when available in database
      // DurationSeconds: media.duration_seconds
    }));

    // Build AlbumDto response (PascalCase)
    const albumDto = {
      AlbumTitle: lock.album_title || 'Untitled Album',
      DateTime: lock.created_at ? lock.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      SealDate: lock.seal_date || null,
      Media: mediaDtos,
      HashedLockId: hashedLockId
    };

    return c.json({
      Success: true,
      Data: albumDto
    });
  } catch (error) {
    console.error('Error fetching album:', error);
    return c.json({
      Success: false,
      Message: 'Failed to fetch album'
    }, 500);
  }
});

export default albums;