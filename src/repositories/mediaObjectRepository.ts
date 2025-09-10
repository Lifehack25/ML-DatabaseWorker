import { MediaObject, D1Result } from '../types';

export interface CreateMediaObjectRequest {
  lock_id: number;
  cloudflare_id?: string;
  url?: string;
  file_name?: string;
  media_type?: string;
  is_main_picture?: boolean;
  display_order?: number;
}

export interface UpdateMediaObjectRequest {
  cloudflare_id?: string;
  url?: string;
  file_name?: string;
  media_type?: string;
  is_main_picture?: boolean;
  display_order?: number;
}

export class MediaObjectRepository {
  constructor(private db: D1Database) {}

  async findById(id: number): Promise<MediaObject | null> {
    const result: D1Result<MediaObject> = await this.db.prepare(
      'SELECT * FROM media_objects WHERE id = ?'
    ).bind(id).all();

    if (!result.success || result.results.length === 0) {
      return null;
    }

    return result.results[0];
  }

  async findByLockId(lockId: number, limit: number = 100): Promise<MediaObject[]> {
    const result: D1Result<MediaObject> = await this.db.prepare(
      'SELECT * FROM media_objects WHERE lock_id = ? ORDER BY display_order ASC, created_at DESC LIMIT ?'
    ).bind(lockId, limit).all();

    if (!result.success) {
      throw new Error('Failed to fetch lock media objects');
    }

    return result.results;
  }

  async create(mediaData: CreateMediaObjectRequest): Promise<MediaObject> {
    // Apply default values matching the .NET model defaults
    const media = {
      lock_id: mediaData.lock_id,
      cloudflare_id: mediaData.cloudflare_id || '',
      url: mediaData.url || '',
      file_name: mediaData.file_name || null,
      media_type: mediaData.media_type || '',
      is_main_picture: mediaData.is_main_picture !== undefined ? mediaData.is_main_picture : false,
      created_at: new Date().toISOString(),
      display_order: mediaData.display_order !== undefined ? mediaData.display_order : 0
    };

    // If this is being set as main picture, unset any existing main picture for this lock
    if (media.is_main_picture) {
      await this.unsetMainPicture(media.lock_id);
    }

    const result: D1Result = await this.db.prepare(`
      INSERT INTO media_objects (
        lock_id, cloudflare_id, url, file_name, media_type, 
        is_main_picture, created_at, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      media.lock_id,
      media.cloudflare_id,
      media.url,
      media.file_name,
      media.media_type,
      media.is_main_picture,
      media.created_at,
      media.display_order
    ).run();

    if (!result.success) {
      throw new Error('Failed to create media object');
    }

    // Fetch the created media object
    const newMedia = await this.findById(result.meta.last_row_id!);
    if (!newMedia) {
      throw new Error('Failed to retrieve created media object');
    }

    return newMedia;
  }

  async update(id: number, mediaData: UpdateMediaObjectRequest): Promise<MediaObject> {
    // Get current media object to check lock_id for main picture logic
    const currentMedia = await this.findById(id);
    if (!currentMedia) {
      throw new Error('Media object not found');
    }

    // If setting as main picture, unset any existing main picture for this lock
    if (mediaData.is_main_picture === true) {
      await this.unsetMainPicture(currentMedia.lock_id);
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];

    if (mediaData.cloudflare_id !== undefined) {
      updateFields.push('cloudflare_id = ?');
      values.push(mediaData.cloudflare_id);
    }

    if (mediaData.url !== undefined) {
      updateFields.push('url = ?');
      values.push(mediaData.url);
    }

    if (mediaData.file_name !== undefined) {
      updateFields.push('file_name = ?');
      values.push(mediaData.file_name);
    }

    if (mediaData.media_type !== undefined) {
      updateFields.push('media_type = ?');
      values.push(mediaData.media_type);
    }

    if (mediaData.is_main_picture !== undefined) {
      updateFields.push('is_main_picture = ?');
      values.push(mediaData.is_main_picture);
    }

    if (mediaData.display_order !== undefined) {
      updateFields.push('display_order = ?');
      values.push(mediaData.display_order);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields provided for update');
    }

    values.push(id); // Add ID for WHERE clause

    const query = `UPDATE media_objects SET ${updateFields.join(', ')} WHERE id = ?`;
    const result: D1Result = await this.db.prepare(query).bind(...values).run();

    if (!result.success) {
      throw new Error('Failed to update media object');
    }

    // Fetch updated media object
    const updatedMedia = await this.findById(id);
    if (!updatedMedia) {
      throw new Error('Media object not found after update');
    }

    return updatedMedia;
  }

  async delete(id: number): Promise<void> {
    const result: D1Result = await this.db.prepare(
      'DELETE FROM media_objects WHERE id = ?'
    ).bind(id).run();

    if (!result.success) {
      throw new Error('Failed to delete media object');
    }
  }

  async deleteByLockId(lockId: number): Promise<void> {
    const result: D1Result = await this.db.prepare(
      'DELETE FROM media_objects WHERE lock_id = ?'
    ).bind(lockId).run();

    if (!result.success) {
      throw new Error('Failed to delete lock media objects');
    }
  }

  private async unsetMainPicture(lockId: number): Promise<void> {
    const result: D1Result = await this.db.prepare(
      'UPDATE media_objects SET is_main_picture = 0 WHERE lock_id = ? AND is_main_picture = 1'
    ).bind(lockId).run();

    if (!result.success) {
      throw new Error('Failed to unset main picture');
    }
  }
}