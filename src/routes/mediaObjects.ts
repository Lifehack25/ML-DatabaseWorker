import { Hono } from 'hono';
import { MediaObjectRepository } from '../repositories/mediaObjectRepository';
import { rateLimiters } from '../middleware/rateLimit';

type Bindings = {
  DB: D1Database;
};

const mediaObjects = new Hono<{ Bindings: Bindings }>();

// Apply rate limiting to POST routes
mediaObjects.post('/', rateLimiters.mediaUpload, async (c) => {
  try {
    const body = await c.req.json();

    if (!body.lockId) {
      return c.json({
        Success: false,
        Message: 'lockId is required'
      }, 400);
    }

    const mediaRepo = new MediaObjectRepository(c.env.DB);

    const newMedia = await mediaRepo.create({
      lock_id: body.lockId,
      cloudflare_id: body.cloudflareId,
      url: body.url,
      thumbnail_url: body.thumbnailUrl,
      file_name: body.fileName,
      is_image: body.isImage ?? true,
      is_main_picture: body.isMainImage || false,
      display_order: body.displayOrder || 0,
      duration_seconds: body.durationSeconds || null
    });

    return c.json({
      Success: true,
      Message: 'Media object created successfully',
      Data: {
        id: newMedia.id,
        lockId: newMedia.lock_id,
        url: newMedia.url,
        thumbnailUrl: newMedia.thumbnail_url || null,
        type: newMedia.is_image ? 'image' : 'video',
        isMainImage: Boolean(newMedia.is_main_picture),
        displayOrder: newMedia.display_order,
        durationSeconds: newMedia.duration_seconds || null
      }
    });
  } catch (error) {
    console.error('Error creating media object:', error);
    return c.json({
      Success: false,
      Message: 'Failed to create media object'
    }, 500);
  }
});

// PATCH /media-objects/:id - Update a media object
// Rate limited to 60 API calls per minute
mediaObjects.patch('/:id', rateLimiters.api, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    if (isNaN(id)) {
      return c.json({
        Success: false,
        Message: 'Invalid media object ID'
      }, 400);
    }

    const mediaRepo = new MediaObjectRepository(c.env.DB);

    const updatedMedia = await mediaRepo.update(id, {
      url: body.url,
      display_order: body.displayOrder,
      is_main_picture: body.isMainImage
    });

    return c.json({
      Success: true,
      Message: 'Media object updated successfully',
      Data: {
        id: updatedMedia.id,
        url: updatedMedia.url,
        displayOrder: updatedMedia.display_order,
        isMainImage: Boolean(updatedMedia.is_main_picture)
      }
    });
  } catch (error) {
    console.error('Error updating media object:', error);
    return c.json({
      Success: false,
      Message: 'Failed to update media object'
    }, 500);
  }
});

// DELETE /media-objects/:id - Delete a media object
// Rate limited to 60 API calls per minute
mediaObjects.delete('/:id', rateLimiters.api, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    if (isNaN(id)) {
      return c.json({
        Success: false,
        Message: 'Invalid media object ID'
      }, 400);
    }

    const mediaRepo = new MediaObjectRepository(c.env.DB);
    await mediaRepo.delete(id);

    return c.json({
      Success: true,
      Message: 'Media object deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting media object:', error);
    return c.json({
      Success: false,
      Message: 'Failed to delete media object'
    }, 500);
  }
});

// POST /media-objects/batch-reorder - Batch update display orders
// Rate limited to 60 API calls per minute
mediaObjects.post('/batch-reorder', rateLimiters.api, async (c) => {
  try {
    const updates = await c.req.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return c.json({
        Success: false,
        Message: 'Updates array is required and must not be empty'
      }, 400);
    }

    // Validate all updates have required fields
    for (const update of updates) {
      if (!update.id || update.displayOrder === undefined) {
        return c.json({
          Success: false,
          Message: 'Each update must have id and displayOrder'
        }, 400);
      }
    }

    // Prepare batch statements
    const statements = updates.map(update =>
      c.env.DB.prepare('UPDATE media_objects SET display_order = ? WHERE id = ?')
        .bind(update.displayOrder, update.id)
    );

    // Execute all updates in a single batch transaction
    const results = await c.env.DB.batch(statements);

    // Check if all updates succeeded
    const successCount = results.filter(r => r.success).length;

    if (successCount === updates.length) {
      return c.json({
        Success: true,
        Message: `Successfully reordered ${successCount} media objects`,
        Data: {
          updatedCount: successCount
        }
      });
    } else {
      return c.json({
        Success: false,
        Message: `Only ${successCount} of ${updates.length} updates succeeded`,
        Data: {
          updatedCount: successCount,
          failedCount: updates.length - successCount
        }
      }, 500);
    }
  } catch (error) {
    console.error('Error batch reordering media objects:', error);
    return c.json({
      Success: false,
      Message: 'Failed to batch reorder media objects'
    }, 500);
  }
});

// PATCH /locks/:lockId/album-title - Update lock album title
// Rate limited to 60 API calls per minute
mediaObjects.patch('/locks/:lockId/album-title', rateLimiters.api, async (c) => {
  try {
    const lockId = parseInt(c.req.param('lockId'));
    const body = await c.req.json();

    if (isNaN(lockId)) {
      return c.json({
        Success: false,
        Message: 'Invalid lock ID'
      }, 400);
    }

    if (!body.albumTitle) {
      return c.json({
        Success: false,
        Message: 'albumTitle is required'
      }, 400);
    }

    const { LockRepository } = await import('../repositories/lockRepository');
    const lockRepo = new LockRepository(c.env.DB);

    await lockRepo.update(lockId, {
      album_title: body.albumTitle
    });

    return c.json({
      Success: true,
      Message: 'Album title updated successfully'
    });
  } catch (error) {
    console.error('Error updating album title:', error);
    return c.json({
      Success: false,
      Message: 'Failed to update album title'
    }, 500);
  }
});

export default mediaObjects;