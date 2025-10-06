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
albums.use('/publish-changes', authMiddleware);

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

type PublishChangesRequest = {
  lockId: number;
  albumTitle?: string;
  existingMedia?: Array<{
    mediaId: number;
    displayOrder: number;
    isMainPicture: boolean;
  }>;
  newMedia?: Array<{
    cloudflareId: string;
    url: string;
    fileName?: string | null;
    mediaType: string;
    displayOrder: number;
    isMainPicture: boolean;
  }>;
  deletedMediaIds?: number[];
};

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
    const body: PublishChangesRequest = await c.req.json();

    const lockId = body.lockId;
    if (!lockId) {
      return c.json({ success: false, message: 'Lock ID is required' }, 400);
    }

    const lockRepo = new LockRepository(c.env.DB);
    const mediaRepo = new MediaObjectRepository(c.env.DB);

    const lock = await lockRepo.findById(lockId);
    if (!lock) {
      return c.json({ success: false, message: 'Lock not found' }, 404);
    }

    const existingMedia = await mediaRepo.findByLockId(lockId, 500);
    const existingLookup = new Map(existingMedia.map((media) => [media.id, media]));

    const existingUpdates = body.existingMedia ?? [];
    const newMedia = body.newMedia ?? [];
    const deletedMediaIds = body.deletedMediaIds ?? [];

    // Validate existing media references
    for (const update of existingUpdates) {
      if (!existingLookup.has(update.mediaId)) {
        return c.json({ success: false, message: `Unknown media item ${update.mediaId}` }, 400);
      }
    }

    for (const id of deletedMediaIds) {
      if (!existingLookup.has(id)) {
        return c.json({ success: false, message: `Unknown media item ${id}` }, 400);
      }
    }

    const originalMain = existingMedia.find((media) => Boolean(media.is_main_picture));
    let albumTitleUpdated = false;

    if (body.albumTitle && body.albumTitle !== lock.album_title) {
      await lockRepo.update(lockId, { album_title: body.albumTitle });
      albumTitleUpdated = true;
    }

    // Update existing media (display order + main flag)
    for (const update of existingUpdates) {
      await mediaRepo.update(update.mediaId, {
        display_order: update.displayOrder,
        is_main_picture: update.isMainPicture
      });
    }

    // Delete media objects
    for (const id of deletedMediaIds) {
      await mediaRepo.delete(id);
    }

    // Create new media objects
    for (const media of newMedia) {
      await mediaRepo.create({
        lock_id: lockId,
        cloudflare_id: media.cloudflareId,
        url: media.url,
        file_name: media.fileName ?? null,
        media_type: media.mediaType,
        is_main_picture: media.isMainPicture,
        display_order: media.displayOrder
      });
    }

    const updatedMedia = await mediaRepo.findByLockId(lockId, 500);
    const updatedMain = updatedMedia.find((media) => Boolean(media.is_main_picture));

    const response = {
      albumTitleUpdated,
      mainImageUpdated: (originalMain?.id ?? null) !== (updatedMain?.id ?? null),
      addedCount: newMedia.length,
      deletedCount: deletedMediaIds.length,
      reorderedCount: existingUpdates.filter((update) => {
        const original = existingLookup.get(update.mediaId);
        return original ? original.display_order !== update.displayOrder : false;
      }).length
    };

    return c.json({ success: true, data: response });
  } catch (error) {
    console.error('Error publishing album changes:', error);
    return c.json({ success: false, message: 'Failed to publish album changes' }, 500);
  }
});

export default albums;
