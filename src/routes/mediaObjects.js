import { Hono } from 'hono';
import { MediaObjectRepository } from '../repositories/mediaObjectRepository';
const mediaObjects = new Hono();
// POST /media-objects - Create a new media object
mediaObjects.post('/', async (c) => {
    try {
        const body = await c.req.json();
        if (!body.lockId) {
            return c.json({
                success: false,
                message: 'lockId is required'
            }, 400);
        }
        const mediaRepo = new MediaObjectRepository(c.env.DB);
        const newMedia = await mediaRepo.create({
            lock_id: body.lockId,
            cloudflare_id: body.cloudflareId,
            url: body.url,
            file_name: body.fileName,
            media_type: body.mediaType || 'image',
            is_main_picture: body.isMainImage || false,
            display_order: body.displayOrder || 0
        });
        return c.json({
            success: true,
            message: 'Media object created successfully',
            data: {
                id: newMedia.id,
                lockId: newMedia.lock_id,
                url: newMedia.url,
                mediaType: newMedia.media_type,
                isMainImage: Boolean(newMedia.is_main_picture),
                displayOrder: newMedia.display_order
            }
        });
    }
    catch (error) {
        console.error('Error creating media object:', error);
        return c.json({
            success: false,
            message: 'Failed to create media object'
        }, 500);
    }
});
// PATCH /media-objects/:id - Update a media object
mediaObjects.patch('/:id', async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const body = await c.req.json();
        if (isNaN(id)) {
            return c.json({
                success: false,
                message: 'Invalid media object ID'
            }, 400);
        }
        const mediaRepo = new MediaObjectRepository(c.env.DB);
        const updatedMedia = await mediaRepo.update(id, {
            url: body.url,
            display_order: body.displayOrder,
            is_main_picture: body.isMainImage
        });
        return c.json({
            success: true,
            message: 'Media object updated successfully',
            data: {
                id: updatedMedia.id,
                url: updatedMedia.url,
                displayOrder: updatedMedia.display_order,
                isMainImage: Boolean(updatedMedia.is_main_picture)
            }
        });
    }
    catch (error) {
        console.error('Error updating media object:', error);
        return c.json({
            success: false,
            message: 'Failed to update media object'
        }, 500);
    }
});
// DELETE /media-objects/:id - Delete a media object
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
        await mediaRepo.delete(id);
        return c.json({
            success: true,
            message: 'Media object deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting media object:', error);
        return c.json({
            success: false,
            message: 'Failed to delete media object'
        }, 500);
    }
});
// PATCH /locks/:lockId/album-title - Update lock album title
mediaObjects.patch('/locks/:lockId/album-title', async (c) => {
    try {
        const lockId = parseInt(c.req.param('lockId'));
        const body = await c.req.json();
        if (isNaN(lockId)) {
            return c.json({
                success: false,
                message: 'Invalid lock ID'
            }, 400);
        }
        if (!body.albumTitle) {
            return c.json({
                success: false,
                message: 'albumTitle is required'
            }, 400);
        }
        const { LockRepository } = await import('../repositories/lockRepository');
        const lockRepo = new LockRepository(c.env.DB);
        await lockRepo.update(lockId, {
            album_title: body.albumTitle
        });
        return c.json({
            success: true,
            message: 'Album title updated successfully'
        });
    }
    catch (error) {
        console.error('Error updating album title:', error);
        return c.json({
            success: false,
            message: 'Failed to update album title'
        }, 500);
    }
});
export default mediaObjects;
