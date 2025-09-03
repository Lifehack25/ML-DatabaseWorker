import { User, CreateUserRequest, D1Result } from '../types';

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

  async findAll(limit: number = 100): Promise<User[]> {
    const result: D1Result<User> = await this.db.prepare(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all();

    if (!result.success) {
      throw new Error('Failed to fetch users');
    }

    return result.results;
  }

  async create(userData: CreateUserRequest): Promise<User> {
    // Apply default values matching the .NET model defaults
    const user = {
      name: userData.name.trim(),
      email: userData.email || null,
      phone_number: userData.phone_number || null,
      auth_provider: userData.auth_provider || '',
      provider_id: userData.provider_id || null,
      email_verified: false, // default
      phone_verified: false, // default
      has_premium_storage: false, // default
      created_at: new Date().toISOString(),
      last_login_at: null
    };

    const result: D1Result = await this.db.prepare(`
      INSERT INTO users (
        name, email, phone_number, auth_provider, provider_id, 
        email_verified, phone_verified, has_premium_storage, 
        created_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.name,
      user.email,
      user.phone_number,
      user.auth_provider,
      user.provider_id,
      user.email_verified,
      user.phone_verified,
      user.has_premium_storage,
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

  async updateLastLogin(id: number): Promise<void> {
    const result: D1Result = await this.db.prepare(
      'UPDATE users SET last_login_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), id).run();

    if (!result.success) {
      throw new Error('Failed to update last login');
    }
  }
}