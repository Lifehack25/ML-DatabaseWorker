import { User, CreateUserDto, D1Result } from '../types';

export class UserRepository {
  constructor(private db: D1Database) {}

  async findById(id: number): Promise<User | null> {
    const result: D1Result<User> = await this.db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(id).all();

    if (!result.success || result.results.length === 0) {
      return null;
    }

    return result.results[0];
  }

  async create(userData: CreateUserDto): Promise<User> {
    // Apply default values matching the .NET model defaults
    const user = {
      name: userData.name.trim(),
      email: userData.email || null,
      phone_number: userData.phoneNumber || null,
      auth_provider: userData.authProvider || '',
      provider_id: userData.providerId || null,
      email_verified: false, // default
      phone_verified: false, // default
      created_at: new Date().toISOString(),
      last_login_at: null
    };

    const result: D1Result = await this.db.prepare(`
      INSERT INTO users (
        name, email, phone_number, auth_provider, provider_id,
        email_verified, phone_verified,
        created_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.name,
      user.email,
      user.phone_number,
      user.auth_provider,
      user.provider_id,
      user.email_verified,
      user.phone_verified,
      user.created_at,
      user.last_login_at
    ).run();

    if (!result.success) {
      throw new Error('Failed to create user');
    }

    // Fetch the created user
    const newUser = await this.findById(result.meta.last_row_id!);
    if (!newUser) {
      throw new Error('Failed to retrieve created user');
    }

    return newUser;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result: D1Result<User> = await this.db.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).all();

    if (!result.success || result.results.length === 0) {
      return null;
    }

    return result.results[0];
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    const result: D1Result<User> = await this.db.prepare(
      'SELECT * FROM users WHERE phone_number = ?'
    ).bind(phoneNumber).all();

    if (!result.success || result.results.length === 0) {
      return null;
    }

    return result.results[0];
  }

  async findByProvider(authProvider: string, providerId: string): Promise<User | null> {
    const result: D1Result<User> = await this.db.prepare(
      'SELECT * FROM users WHERE auth_provider = ? AND provider_id = ?'
    ).bind(authProvider, providerId).all();

    if (!result.success || result.results.length === 0) {
      return null;
    }

    return result.results[0];
  }

  async linkProvider(userId: number, authProvider: string, providerId: string): Promise<void> {
    const result = await this.db.prepare(
      'UPDATE users SET auth_provider = ?, provider_id = ? WHERE id = ?'
    ).bind(authProvider, providerId, userId).run();

    if (!result.success) {
      throw new Error('Failed to link OAuth provider to user');
    }
  }

  async updateEmail(userId: number, email: string | null): Promise<void> {
    const result = await this.db.prepare(
      'UPDATE users SET email = ? WHERE id = ?'
    ).bind(email, userId).run();

    if (!result.success) {
      throw new Error('Failed to update user email');
    }
  }

  async updatePhoneNumber(userId: number, phoneNumber: string | null): Promise<void> {
    const result = await this.db.prepare(
      'UPDATE users SET phone_number = ? WHERE id = ?'
    ).bind(phoneNumber, userId).run();

    if (!result.success) {
      throw new Error('Failed to update user phone number');
    }
  }

  async markEmailVerified(userId: number): Promise<void> {
    const result = await this.db.prepare(
      'UPDATE users SET email_verified = 1 WHERE id = ?'
    ).bind(userId).run();

    if (!result.success) {
      throw new Error('Failed to update email verification status');
    }
  }

  async markPhoneVerified(userId: number): Promise<void> {
    const result = await this.db.prepare(
      'UPDATE users SET phone_verified = 1 WHERE id = ?'
    ).bind(userId).run();

    if (!result.success) {
      throw new Error('Failed to update phone verification status');
    }
  }

  async updateAuthMetadata(userId: number, metadata: { email_verified?: boolean; phone_verified?: boolean; last_login_at?: string }): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (typeof metadata.email_verified === 'boolean') {
      updates.push('email_verified = ?');
      values.push(metadata.email_verified ? 1 : 0);
    }

    if (typeof metadata.phone_verified === 'boolean') {
      updates.push('phone_verified = ?');
      values.push(metadata.phone_verified ? 1 : 0);
    }

    if (typeof metadata.last_login_at === 'string') {
      updates.push('last_login_at = ?');
      values.push(metadata.last_login_at);
    }

    if (updates.length === 0) {
      return;
    }

    values.push(userId);

    const result = await this.db.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    if (!result.success) {
      throw new Error('Failed to update user authentication metadata');
    }
  }

  async delete(userId: number): Promise<void> {
    const result = await this.db.prepare(
      'DELETE FROM users WHERE id = ?'
    ).bind(userId).run();

    if (!result.success) {
      throw new Error('Failed to delete user');
    }
  }
}
