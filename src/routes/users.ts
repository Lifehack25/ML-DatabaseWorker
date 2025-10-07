import { Hono } from 'hono';
import type { Context } from 'hono';
import { UserRepository } from '../repositories/userRepository';
import { SendCodeDto, ValidatedIdentifier, CreateUserDto, Response, UpdateAuthMetadataRequest } from '../types';

type Bindings = {
  DB: D1Database;
};

type UsersContext = Context<{ Bindings: Bindings }>;

const users = new Hono<{ Bindings: Bindings }>();

// Helper function to get UserRepository instance
const getUserRepo = (db: D1Database) => new UserRepository(db);

const respondSuccess = <T>(c: UsersContext, data: T, message?: string) =>
  c.json({ success: true, message, data });

const respondFailure = <T>(c: UsersContext, message: string, statusCode: number, data?: T) =>
  c.json({ success: false, message, data }, statusCode as any);

// Unified auth-check endpoint for login and registration
users.post('/exist-check', async (c) => {
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
users.post('/find-by-identifier', async (c) => {
  try {
    const { isEmail, identifier }: ValidatedIdentifier = await c.req.json();
    const userRepo = getUserRepo(c.env.DB);

    const user = isEmail
      ? await userRepo.findByEmail(identifier)
      : await userRepo.findByPhoneNumber(identifier);

    if (user) {
      return respondSuccess(c, user.id, 'User found successfully');
    }

    return c.json({ success: true, message: 'User not found', data: 0 }, 404 as any);
  } catch (error) {
    console.error('Error finding user:', error);
    return respondFailure(c, 'Failed to find user', 500, 0);
  }
});

// Create new user
users.post('/create', async (c) => {
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
    const newUser = await userRepo.create({
      name: userData.name,
      email: userData.email,
      phone_number: userData.phoneNumber,
      auth_provider: userData.authProvider || 'Registration',
      provider_id: userData.providerId
    });
    
    return c.json({ success: true, message: 'User created successfully', data: newUser.id }, 201 as any);
  } catch (error) {
    console.error('Error creating user:', error);
    return respondFailure(c, 'Failed to create user', 500, 0);
  }
});

// Find user by OAuth provider
users.post('/find-by-provider', async (c) => {
  try {
    const { authProvider, providerId } = await c.req.json();
    const userRepo = getUserRepo(c.env.DB);

    const user = await userRepo.findByProvider(authProvider, providerId);

    if (user) {
      return respondSuccess(c, user.id, 'User found successfully');
    }

    return c.json({ success: true, message: 'User not found', data: 0 }, 404 as any);
  } catch (error) {
    console.error('Error finding user by provider:', error);
    return respondFailure(c, 'Failed to find user by provider', 500, 0);
  }
});

// Link OAuth provider to existing user
users.post('/link-provider', async (c) => {
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

// Update authentication metadata such as email verification and last login timestamp
users.post('/update-auth-metadata', async (c) => {
  try {
    const { userId, emailVerified, lastLoginAt }: UpdateAuthMetadataRequest = await c.req.json();

    if (!userId || userId <= 0) {
      return respondFailure(c, 'Invalid user ID supplied', 400, false);
    }

    const updates: { email_verified?: boolean; last_login_at?: string } = {};

    if (typeof emailVerified === 'boolean') {
      updates.email_verified = emailVerified;
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

export default users;
