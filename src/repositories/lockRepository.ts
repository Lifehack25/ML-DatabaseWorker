import { Lock, D1Result } from '../types';
import { SCAN_MILESTONES } from '../constants/milestones';

export interface CreateLockRequest {
  lock_name?: string;
  album_title?: string;
  seal_date?: string; // ISO date string YYYY-MM-DD
  user_id?: number;
}

export interface UpdateLockRequest {
  lock_name?: string;
  album_title?: string;
  seal_date?: string | null; // ISO date string YYYY-MM-DD or null to clear
  user_id?: number;
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

  async findByUserId(userId: number, limit: number = 100): Promise<Lock[]> {
    const result: D1Result<Lock> = await this.db.prepare(
      'SELECT * FROM locks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    ).bind(userId, limit).all();

    if (!result.success) {
      throw new Error('Failed to fetch user locks');
    }

    return result.results;
  }

  async findAllByUserId(userId: number): Promise<Lock[]> {
    const result: D1Result<Lock> = await this.db.prepare(
      'SELECT * FROM locks WHERE user_id = ?'
    ).bind(userId).all();

    if (!result.success) {
      throw new Error('Failed to fetch user locks');
    }

    return result.results;
  }

  async clearUserAssociation(userId: number): Promise<void> {
    const result: D1Result = await this.db.prepare(
      'UPDATE locks SET user_id = NULL WHERE user_id = ?'
    ).bind(userId).run();

    if (!result.success) {
      throw new Error('Failed to clear user association from locks');
    }
  }

  async create(lockData: CreateLockRequest): Promise<Lock> {
    // Apply default values matching the .NET model defaults
    const lock = {
      lock_name: lockData.lock_name || 'Memory Lock',
      album_title: lockData.album_title || 'Wonderful Memories',
      seal_date: lockData.seal_date || null,
      scan_count: 0, // default
      created_at: new Date().toISOString(),
      user_id: lockData.user_id || null
    };

    const result: D1Result = await this.db.prepare(`
      INSERT INTO locks (
        lock_name, album_title, seal_date, 
        scan_count, created_at, user_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      lock.lock_name,
      lock.album_title,
      lock.seal_date,
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

    if (lockData.user_id !== undefined) {
      updateFields.push('user_id = ?');
      values.push(lockData.user_id);
    }

    if (lockData.upgraded_storage !== undefined) {
      updateFields.push('upgraded_storage = ?');
      values.push(lockData.upgraded_storage ? 1 : 0);
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

  async incrementScanCount(id: number): Promise<{ lock: Lock; milestoneReached: number | null }> {
    const existingLock = await this.findById(id);
    if (!existingLock) {
      throw new Error('Lock not found before scan count update');
    }

    const currentMilestone = existingLock.last_scan_milestone ?? 0;
    const newScanCount = existingLock.scan_count + 1;
    const milestoneReached =
      SCAN_MILESTONES.includes(newScanCount) && newScanCount > currentMilestone
        ? newScanCount
        : null;
    const milestoneToPersist = milestoneReached ?? currentMilestone;

    const result: D1Result = await this.db
      .prepare('UPDATE locks SET scan_count = ?, last_scan_milestone = ? WHERE id = ?')
      .bind(newScanCount, milestoneToPersist, id)
      .run();

    if (!result.success) {
      throw new Error('Failed to increment scan count');
    }

    const updatedLock = await this.findById(id);
    if (!updatedLock) {
      throw new Error('Lock not found after scan count update');
    }

    return { lock: updatedLock, milestoneReached };
  }

  async getLastLock(): Promise<Lock | null> {
    const result: D1Result<Lock> = await this.db.prepare(
      'SELECT * FROM locks ORDER BY id DESC LIMIT 1'
    ).all();

    if (!result.success || result.results.length === 0) {
      return null;
    }

    return result.results[0];
  }
}
