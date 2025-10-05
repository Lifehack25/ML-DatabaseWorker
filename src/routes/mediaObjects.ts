import { Hono } from 'hono';
import { MediaObjectRepository } from '../repositories/mediaObjectRepository';
import { LockRepository } from '../repositories/lockRepository';
import { CreateMediaObjectRequest, UpdateMediaObjectRequest, MediaObject } from '../types';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  WORKER_API_KEY: string;
};

const mediaObjects = new Hono<{ Bindings: Bindings }>();

// Apply auth middleware to all routes
mediaObjects.use('*', authMiddleware);

// Create a new media object
mediaObjects.post('/', async (c) => {
  try {
    const request: CreateMediaObjectRequest = await c.req.json();

    const mediaRepo = new MediaObjectRepository(c.env.DB);
    const lockRepo = new LockRepository(c.env.DB);

    // Verify lock exists
    const lock = await lockRepo.findById(request.lock_id);
    if (!lock) {
      return c.json({
        success: false,
        message: 'Lock not found'
      }, 404);
    }

    const mediaObject = await mediaRepo.create(request);

    return c.json({
      success: true,
      data: mediaObject
    });
  } catch (error) {
    console.error('Error creating media object:', error);
    return c.json({
      success: false,
      message: 'Failed to create media object'
    }, 500);
  }
});

// Update a media object
mediaObjects.put('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const request: UpdateMediaObjectRequest = await c.req.json();

    if (isNaN(id)) {
      return c.json({
        success: false,
        message: 'Invalid media object ID'
      }, 400);
    }

    const mediaRepo = new MediaObjectRepository(c.env.DB);
    const mediaObject = await mediaRepo.update(id, request);

    if (!mediaObject) {
      return c.json({
        success: false,
        message: 'Media object not found'
      }, 404);
    }

    return c.json({
      success: true,
      data: mediaObject
    });
  } catch (error) {
    console.error('Error updating media object:', error);
    return c.json({
      success: false,
      message: 'Failed to update media object'
    }, 500);
  }
});

// Delete a media object
mediaObjects.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    if (isNaN(id)) {
      return c.json({
        success: false,
        message: 'Invalid media object ID'
      }, 400);
    }

    const mediaRepo = new MediaObjectRepository(c.env.DB);
    const deleted = await mediaRepo.delete(id);

    if (!deleted) {
      return c.json({
        success: false,
        message: 'Media object not found'
      }, 404);
    }

    return c.json({
      success: true,
      message: 'Media object deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting media object:', error);
    return c.json({
      success: false,
      message: 'Failed to delete media object'
    }, 500);
  }
});

// Reorder media objects for a lock
mediaObjects.post('/reorder', async (c) => {
  try {
    const { lockId, mediaOrder }: { lockId: number; mediaOrder: { mediaId: number; displayOrder: number }[] } = await c.req.json();

    const mediaRepo = new MediaObjectRepository(c.env.DB);
    const lockRepo = new LockRepository(c.env.DB);

    // Verify lock exists
    const lock = await lockRepo.findById(lockId);
    if (!lock) {
      return c.json({
        success: false,
        message: 'Lock not found'
      }, 404);
    }

    // Update display orders
    for (const item of mediaOrder) {
      await mediaRepo.update(item.mediaId, { display_order: item.displayOrder });
    }

    return c.json({
      success: true,
      message: 'Media objects reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering media objects:', error);
    return c.json({
      success: false,
      message: 'Failed to reorder media objects'
    }, 500);
  }
});

export default mediaObjects;