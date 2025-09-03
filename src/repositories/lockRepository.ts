import { Lock, D1Result } from '../types';

export interface CreateLockRequest {
  lock_name?: string;
  album_title?: string;
  seal_date?: string; // ISO date string YYYY-MM-DD
  notified_when_scanned?: boolean;
  user_id?: number;
}

export interface UpdateLockRequest {
  lock_name?: string;
  album_title?: string;
  seal_date?: string; // ISO date string YYYY-MM-DD
  notified_when_scanned?: boolean;
}

export class LockRepository {
  constructor(private db: D1Database) {}

  async findById(id: number): Promise<Lock | null> {
    const result: D1Result<Lock> = await this.db.prepare(
      'SELECT * FROM locks WHERE id = ?'
    ).bind(id).all();

    if (!result.success || result.results.length === 0) {
      return null;
    }

    return result.results[0];
  }

  async findAll(limit: number = 100): Promise<Lock[]> {
    const result: D1Result<Lock> = await this.db.prepare(
      'SELECT * FROM locks ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all();

    if (!result.success) {
      throw new Error('Failed to fetch locks');
    }

    return result.results;
  }

  async findByUserId(userId: number, limit: number = 100): Promise<Lock[]> {
    const result: D1Result<Lock> = await this.db.prepare(
      'SELECT * FROM locks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    ).bind(userId, limit).all();

    if (!result.success) {
      throw new Error('Failed to fetch user locks');
    }

    return result.results;
  }

  async create(lockData: CreateLockRequest): Promise<Lock> {
    // Apply default values matching the .NET model defaults
    const lock = {
      lock_name: lockData.lock_name || 'Memory Lock',
      album_title: lockData.album_title || 'Wonderful Memories',
      seal_date: lockData.seal_date || null,
      notified_when_scanned: lockData.notified_when_scanned !== undefined ? lockData.notified_when_scanned : true,
      scan_count: 0, // default
      created_at: new Date().toISOString(),
      user_id: lockData.user_id || null
    };

    const result: D1Result = await this.db.prepare(`
      INSERT INTO locks (
        lock_name, album_title, seal_date, notified_when_scanned, 
        scan_count, created_at, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      lock.lock_name,
      lock.album_title,
      lock.seal_date,
      lock.notified_when_scanned,
      lock.scan_count,
      lock.created_at,
      lock.user_id
    ).run();

    if (!result.success) {
      throw new Error('Failed to create lock');
    }

    // Fetch the created lock
    const newLock = await this.findById(result.meta.last_row_id!);
    if (!newLock) {
      throw new Error('Failed to retrieve created lock');
    }

    return newLock;
  }

  async update(id: number, lockData: UpdateLockRequest): Promise<Lock> {
    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];

    if (lockData.lock_name !== undefined) {
      updateFields.push('lock_name = ?');
      values.push(lockData.lock_name);
    }

    if (lockData.album_title !== undefined) {
      updateFields.push('album_title = ?');
      values.push(lockData.album_title);
    }

    if (lockData.seal_date !== undefined) {
      updateFields.push('seal_date = ?');
      values.push(lockData.seal_date);
    }

    if (lockData.notified_when_scanned !== undefined) {
      updateFields.push('notified_when_scanned = ?');
      values.push(lockData.notified_when_scanned);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields provided for update');
    }

    values.push(id); // Add ID for WHERE clause

    const query = `UPDATE locks SET ${updateFields.join(', ')} WHERE id = ?`;
    const result: D1Result = await this.db.prepare(query).bind(...values).run();

    if (!result.success) {
      throw new Error('Failed to update lock');
    }

    // Fetch updated lock
    const updatedLock = await this.findById(id);
    if (!updatedLock) {
      throw new Error('Lock not found after update');
    }

    return updatedLock;
  }

  async delete(id: number): Promise<void> {
    const result: D1Result = await this.db.prepare(
      'DELETE FROM locks WHERE id = ?'
    ).bind(id).run();

    if (!result.success) {
      throw new Error('Failed to delete lock');
    }
  }

  async incrementScanCount(id: number): Promise<Lock> {
    const result: D1Result = await this.db.prepare(
      'UPDATE locks SET scan_count = scan_count + 1 WHERE id = ?'
    ).bind(id).run();

    if (!result.success) {
      throw new Error('Failed to increment scan count');
    }

    const updatedLock = await this.findById(id);
    if (!updatedLock) {
      throw new Error('Lock not found after scan count update');
    }

    return updatedLock;
  }

  async findWithMediaCount(limit: number = 100): Promise<Array<Lock & { media_count: number }>> {
    const result = await this.db.prepare(`
      SELECT l.*, COUNT(mo.id) as media_count
      FROM locks l
      LEFT JOIN media_objects mo ON l.id = mo.lock_id
      GROUP BY l.id
      ORDER BY l.created_at DESC
      LIMIT ?
    `).bind(limit).all();

    if (!result.success) {
      throw new Error('Failed to fetch locks with media count');
    }

    return result.results as Array<Lock & { media_count: number }>;
  }

  async findByUserIdWithMediaCount(userId: number, limit: number = 100): Promise<Array<Lock & { media_count: number }>> {
    const result = await this.db.prepare(`
      SELECT l.*, COUNT(mo.id) as media_count
      FROM locks l
      LEFT JOIN media_objects mo ON l.id = mo.lock_id
      WHERE l.user_id = ?
      GROUP BY l.id
      ORDER BY l.created_at DESC
      LIMIT ?
    `).bind(userId, limit).all();

    if (!result.success) {
      throw new Error('Failed to fetch user locks with media count');
    }

    return result.results as Array<Lock & { media_count: number }>;
  }
}