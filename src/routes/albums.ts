import { Hono } from 'hono';
import Hashids from 'hashids';
import { LockRepository } from '../repositories/lockRepository';
import { MediaObjectRepository } from '../repositories/mediaObjectRepository';
import { AlbumDetailsDto, AlbumMediaDto } from '../types';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  WORKER_API_KEY: string;
};

const albums = new Hono<{ Bindings: Bindings }>();

// Apply auth middleware to protected routes
albums.use('/update-title', authMiddleware);

const HASHIDS_SALT = 'GzFbxMxQkArX1cLMo3tnGmpNxL5lUOROXXum5xfhiPU=';
const HASHIDS_MIN_LENGTH = 6;
const hashids = new Hashids(HASHIDS_SALT, HASHIDS_MIN_LENGTH);

const isNumeric = (value: string): boolean => /^\d+$/.test(value);

const mapMediaToDto = (media: any): AlbumMediaDto => ({
  mediaId: media.id,
  cloudflareId: media.cloudflare_id,
  url: media.url,
  fileName: media.file_name ?? null,
  mediaType: media.media_type,
  isMainPicture: Boolean(typeof media.is_main_picture === 'number' ? media.is_main_picture : media.is_main_picture === true),
  displayOrder: media.display_order ?? 0,
  createdAt: media.created_at
});

albums.get('/:identifier', async (c) => {
  const { identifier } = c.req.param();

  if (!identifier) {
    return c.json({
      success: false,
      message: 'Album identifier is required'
    }, 400);
  }

  let lockId: number | null = null;

  if (isNumeric(identifier)) {
    lockId = Number(identifier);
  } else {
    const decoded = hashids.decode(identifier);
    if (decoded.length > 0 && typeof decoded[0] === 'number') {
      lockId = Number(decoded[0]);
    }
  }

  if (!lockId || Number.isNaN(lockId) || lockId <= 0) {
    return c.json({
      success: false,
      message: 'Album not found'
    }, 404);
  }

  try {
    const lockRepo = new LockRepository(c.env.DB);
    const mediaRepo = new MediaObjectRepository(c.env.DB);

    const lock = await lockRepo.findById(lockId);
    if (!lock) {
      return c.json({
        success: false,
        message: 'Album not found'
      }, 404);
    }

    const mediaObjects = await mediaRepo.findByLockId(lockId, 500);
    const media = mediaObjects.map(mapMediaToDto);

    const response: AlbumDetailsDto = {
      lockId: lock.id,
      lockName: lock.lock_name,
      albumTitle: lock.album_title,
      sealDate: lock.seal_date || null,
      hashedLockId: hashids.encode(lock.id),
      media
    };

    return c.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error fetching album:', error);
    return c.json({
      success: false,
      message: 'Failed to fetch album'
    }, 500);
  }
});

// Update album title
albums.post('/update-title', async (c) => {
  try {
    const { lockId, albumTitle }: { lockId: number; albumTitle: string } = await c.req.json();

    if (!lockId || !albumTitle) {
      return c.json({
        success: false,
        message: 'Lock ID and album title are required'
      }, 400);
    }

    const lockRepo = new LockRepository(c.env.DB);

    // Verify lock exists
    const lock = await lockRepo.findById(lockId);
    if (!lock) {
      return c.json({
        success: false,
        message: 'Lock not found'
      }, 404);
    }

    // Update album title
    const updatedLock = await lockRepo.update(lockId, { album_title: albumTitle });

    return c.json({
      success: true,
      data: {
        lockId: updatedLock.id,
        albumTitle: updatedLock.album_title
      }
    });
  } catch (error) {
    console.error('Error updating album title:', error);
    return c.json({
      success: false,
      message: 'Failed to update album title'
    }, 500);
  }
});

// Batch publish changes endpoint - called by Core API after authentication
albums.post('/publish-changes', async (c) => {
  try {
    const {
      lockId,
      albumTitle,
      mediaChanges
    }: {
      lockId: number;
      albumTitle?: string;
      mediaChanges: Array<{
        mediaId?: number;
        changeType: 'reorder' | 'delete';
        newDisplayOrder?: number;
      }>
    } = await c.req.json();

    if (!lockId) {
      return c.json({
        success: false,
        message: 'Lock ID is required'
      }, 400);
    }

    const lockRepo = new LockRepository(c.env.DB);
    const mediaRepo = new MediaObjectRepository(c.env.DB);

    // Verify lock exists
    const lock = await lockRepo.findById(lockId);
    if (!lock) {
      return c.json({
        success: false,
        message: 'Lock not found'
      }, 404);
    }

    let albumTitleUpdated = false;
    let reorderedCount = 0;
    let deletedCount = 0;
    const errors: string[] = [];

    // Update album title if provided
    if (albumTitle && albumTitle !== lock.album_title) {
      try {
        await lockRepo.update(lockId, { album_title: albumTitle });
        albumTitleUpdated = true;
      } catch (error) {
        errors.push('Failed to update album title');
      }
    }

    // Process media changes
    for (const change of mediaChanges) {
      try {
        if (change.changeType === 'reorder' && change.mediaId && change.newDisplayOrder !== undefined) {
          await mediaRepo.update(change.mediaId, { display_order: change.newDisplayOrder });
          reorderedCount++;
        } else if (change.changeType === 'delete' && change.mediaId) {
          const deleted = await mediaRepo.delete(change.mediaId);
          if (deleted) {
            deletedCount++;
          }
        }
      } catch (error) {
        errors.push(`Failed to ${change.changeType} media item ${change.mediaId}`);
      }
    }

    const summary = [
      albumTitleUpdated ? 'Album title updated' : '',
      reorderedCount > 0 ? `${reorderedCount} items reordered` : '',
      deletedCount > 0 ? `${deletedCount} items deleted` : ''
    ].filter(Boolean).join(', ') || 'No changes made';

    return c.json({
      success: errors.length === 0,
      data: {
        albumTitleUpdated,
        reorderedCount,
        deletedCount,
        summary,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Error publishing album changes:', error);
    return c.json({
      success: false,
      message: 'Failed to publish album changes'
    }, 500);
  }
});

export default albums;
