import { Hono } from 'hono';
import type { Context } from 'hono';
import { UserRepository } from '../repositories/userRepository';
import { SendCodeDto, ValidatedIdentifier, CreateUserDto, Response, UpdateAuthMetadataRequest, VerifyIdentifierRequest } from '../types';
import { rateLimiters } from '../middleware/rateLimit';

type Bindings = {
  DB: D1Database;
};

type UsersContext = Context<{ Bindings: Bindings }>;

const users = new Hono<{ Bindings: Bindings }>();

// Helper function to get UserRepository instance
const getUserRepo = (db: D1Database) => new UserRepository(db);

const respondSuccess = <T>(c: UsersContext, data: T, message?: string) =>
  c.json({ Success: true, Message: message, Data: data });

const respondFailure = <T>(c: UsersContext, message: string, statusCode: number, data?: T) =>
  c.json({ Success: false, Message: message, Data: data }, statusCode as any);

// Unified auth-check endpoint for login and registration
// Rate limited to 60 requests per minute
users.post('/exist-check', rateLimiters.api, async (c) => {
  try {
    const dto: SendCodeDto = await c.req.json();
    const userRepo = getUserRepo(c.env.DB);
    
    // Find user by email or phone number
    const user = dto.isEmail
      ? await userRepo.findByEmail(dto.identifier)
      : await userRepo.findByPhoneNumber(dto.identifier);
    
    return respondSuccess(c, !!user, 'User existence check completed');
  } catch (error) {
    console.error('Error in auth-check:', error);
    return respondFailure(c, 'Failed to process auth check', 500, false);
  }
});

// Find user by identifier (email or phone)
// Rate limited to 60 requests per minute
users.post('/find-by-identifier', rateLimiters.api, async (c) => {
  try {
    const { isEmail, identifier }: ValidatedIdentifier = await c.req.json();
    const userRepo = getUserRepo(c.env.DB);

    const user = isEmail
      ? await userRepo.findByEmail(identifier)
      : await userRepo.findByPhoneNumber(identifier);

    if (user) {
      return respondSuccess(c, user.id, 'User found successfully');
    }

    return c.json({ Success: true, Message: 'User not found', Data: 0 }, 404 as any);
  } catch (error) {
    console.error('Error finding user:', error);
    return respondFailure(c, 'Failed to find user', 500, 0);
  }
});

// Create new user
// Rate limited to 60 requests per minute
users.post('/create', rateLimiters.api, async (c) => {
  try {
    const userData: CreateUserDto = await c.req.json();
    const userRepo = getUserRepo(c.env.DB);
    
    // Check if user already exists
    const existingUser = userData.email
      ? await userRepo.findByEmail(userData.email)
      : userData.phoneNumber ? await userRepo.findByPhoneNumber(userData.phoneNumber) : null;
    
    if (existingUser) {
      return respondFailure(c, 'User already exists', 409, 0);
    }
    
    // Create the user
    const newUser = await userRepo.create(userData);
    
    return c.json({ Success: true, Message: 'User created successfully', Data: newUser.id }, 201 as any);
  } catch (error) {
    console.error('Error creating user:', error);
    return respondFailure(c, 'Failed to create user', 500, 0);
  }
});

// Find user by OAuth provider
// Rate limited to 60 requests per minute
users.post('/find-by-provider', rateLimiters.api, async (c) => {
  try {
    const { authProvider, providerId } = await c.req.json();
    const userRepo = getUserRepo(c.env.DB);

    const user = await userRepo.findByProvider(authProvider, providerId);

    if (user) {
      return respondSuccess(c, user.id, 'User found successfully');
    }

    return c.json({ Success: true, Message: 'User not found', Data: 0 }, 404 as any);
  } catch (error) {
    console.error('Error finding user by provider:', error);
    return respondFailure(c, 'Failed to find user by provider', 500, 0);
  }
});

// Link OAuth provider to existing user
// Rate limited to 60 requests per minute
users.post('/link-provider', rateLimiters.api, async (c) => {
  try {
    const { userId, authProvider, providerId } = await c.req.json();
    const userRepo = getUserRepo(c.env.DB);
    
    // Check if user exists
    const user = await userRepo.findById(userId);
    if (!user) {
      return respondFailure(c, 'User not found', 404, false);
    }
    
    // Link the provider
    await userRepo.linkProvider(userId, authProvider, providerId);
    
    return respondSuccess(c, true, 'OAuth provider linked successfully');
  } catch (error) {
    console.error('Error linking provider:', error);
    return respondFailure(c, 'Failed to link OAuth provider', 500, false);
  }
});

// Update authentication metadata such as email verification, phone verification, and last login timestamp
// Rate limited to 60 requests per minute
users.post('/update-auth-metadata', rateLimiters.api, async (c) => {
  try {
    const { userId, emailVerified, phoneVerified, lastLoginAt }: UpdateAuthMetadataRequest = await c.req.json();

    if (!userId || userId <= 0) {
      return respondFailure(c, 'Invalid user ID supplied', 400, false);
    }

    const updates: { email_verified?: boolean; phone_verified?: boolean; last_login_at?: string } = {};

    if (typeof emailVerified === 'boolean') {
      updates.email_verified = emailVerified;
    }

    if (typeof phoneVerified === 'boolean') {
      updates.phone_verified = phoneVerified;
    }

    if (typeof lastLoginAt === 'string' && lastLoginAt.length > 0) {
      updates.last_login_at = lastLoginAt;
    }

    if (Object.keys(updates).length === 0) {
      return respondSuccess(c, true, 'No changes requested');
    }

    const userRepo = getUserRepo(c.env.DB);
    await userRepo.updateAuthMetadata(userId, updates);

    return respondSuccess(c, true, 'Authentication metadata updated successfully');
  } catch (error) {
    console.error('Error updating auth metadata:', error);
    return respondFailure(c, 'Failed to update authentication metadata', 500, false);
  }
});

// Get user profile by ID
users.get('/:userId', rateLimiters.read, async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'));
    if (isNaN(userId) || userId <= 0) {
      return respondFailure(c, 'Invalid user ID supplied', 400, null);
    }

    const userRepo = getUserRepo(c.env.DB);
    const user = await userRepo.findById(userId);

    if (!user) {
      return respondFailure(c, 'User not found', 404, null);
    }

    const profile = {
      id: user.id,
      name: user.name ?? '',
      email: user.email ?? null,
      phoneNumber: user.phone_number ?? null,
      emailVerified: !!user.email_verified,
      phoneVerified: !!user.phone_verified,
      authProvider: user.auth_provider,
      providerId: user.provider_id ?? null
    };

    return respondSuccess(c, profile, 'User retrieved successfully');
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return respondFailure(c, 'Failed to fetch user profile', 500, null);
  }
});

// Verify and update identifier status (email or phone)
users.post('/verify-identifier', rateLimiters.api, async (c) => {
  try {
    const dto: VerifyIdentifierRequest = await c.req.json();
    const identifier = dto.identifier?.trim();

    if (!dto.userId || dto.userId <= 0 || !identifier) {
      return respondFailure(c, 'Invalid verification payload', 400, false);
    }

    const userRepo = getUserRepo(c.env.DB);
    const user = await userRepo.findById(dto.userId);

    if (!user) {
      return respondFailure(c, 'User not found', 404, false);
    }

    if (dto.isEmail) {
      const storedEmail = user.email?.trim();
      if (storedEmail) {
        if (storedEmail.toLowerCase() !== identifier.toLowerCase()) {
          return respondFailure(c, 'Email does not match existing account email', 409, false);
        }
      } else {
        await userRepo.updateEmail(dto.userId, identifier);
      }

      await userRepo.markEmailVerified(dto.userId);
    } else {
      const storedPhone = (user.phone_number ?? '').replace(/\s+/g, '');
      const normalizedInput = identifier.replace(/\s+/g, '');

      if (storedPhone) {
        if (storedPhone !== normalizedInput) {
          return respondFailure(c, 'Phone number does not match existing account phone', 409, false);
        }
      } else {
        await userRepo.updatePhoneNumber(dto.userId, identifier);
      }

      await userRepo.markPhoneVerified(dto.userId);
    }

    return respondSuccess(c, true, 'Identifier verification updated successfully');
  } catch (error) {
    console.error('Error verifying identifier:', error);
    return respondFailure(c, 'Failed to verify identifier', 500, false);
  }
});

// Delete user account
users.delete('/:userId', rateLimiters.api, async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'));
    if (isNaN(userId) || userId <= 0) {
      return respondFailure(c, 'Invalid user ID supplied', 400, false);
    }

    const userRepo = getUserRepo(c.env.DB);
    const existingUser = await userRepo.findById(userId);

    if (!existingUser) {
      return respondFailure(c, 'User not found', 404, false);
    }

    await userRepo.delete(userId);

    return respondSuccess(c, true, 'User deleted successfully');
  } catch (error) {
    console.error('Error deleting user:', error);
    return respondFailure(c, 'Failed to delete user', 500, false);
  }
});

export default users;
