export class UserRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findById(id) {
        const result = await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).all();
        if (!result.success || result.results.length === 0) {
            return null;
        }
        return result.results[0];
    }
    async create(userData) {
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
        const result = await this.db.prepare(`
      INSERT INTO users (
        name, email, phone_number, auth_provider, provider_id, 
        email_verified, phone_verified, has_premium_storage, 
        created_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(user.name, user.email, user.phone_number, user.auth_provider, user.provider_id, user.email_verified, user.phone_verified, user.has_premium_storage, user.created_at, user.last_login_at).run();
        if (!result.success) {
            throw new Error('Failed to create user');
        }
        // Fetch the created user
        const newUser = await this.findById(result.meta.last_row_id);
        if (!newUser) {
            throw new Error('Failed to retrieve created user');
        }
        return newUser;
    }
    async findByEmail(email) {
        const result = await this.db.prepare('SELECT * FROM users WHERE email = ?').bind(email).all();
        if (!result.success || result.results.length === 0) {
            return null;
        }
        return result.results[0];
    }
    async findByPhoneNumber(phoneNumber) {
        const result = await this.db.prepare('SELECT * FROM users WHERE phone_number = ?').bind(phoneNumber).all();
        if (!result.success || result.results.length === 0) {
            return null;
        }
        return result.results[0];
    }
    async findByProvider(authProvider, providerId) {
        const result = await this.db.prepare('SELECT * FROM users WHERE auth_provider = ? AND provider_id = ?').bind(authProvider, providerId).all();
        if (!result.success || result.results.length === 0) {
            return null;
        }
        return result.results[0];
    }
    async linkProvider(userId, authProvider, providerId) {
        const result = await this.db.prepare('UPDATE users SET auth_provider = ?, provider_id = ? WHERE id = ?').bind(authProvider, providerId, userId).run();
        if (!result.success) {
            throw new Error('Failed to link OAuth provider to user');
        }
    }
    async updateAuthMetadata(userId, metadata) {
        const updates = [];
        const values = [];
        if (typeof metadata.email_verified === 'boolean') {
            updates.push('email_verified = ?');
            values.push(metadata.email_verified ? 1 : 0);
        }
        if (typeof metadata.last_login_at === 'string') {
            updates.push('last_login_at = ?');
            values.push(metadata.last_login_at);
        }
        if (updates.length === 0) {
            return;
        }
        values.push(userId);
        const result = await this.db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
        if (!result.success) {
            throw new Error('Failed to update user authentication metadata');
        }
    }
}
