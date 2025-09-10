import { Hono } from 'hono';
import { UserRepository } from '../repositories/userRepository';
import { SendCodeDto, ValidatedIdentifier, CreateUserDto, Response } from '../types';

type Bindings = {
  DB: D1Database;
};

const users = new Hono<{ Bindings: Bindings }>();

// Helper function to get UserRepository instance
const getUserRepo = (db: D1Database) => new UserRepository(db);

// Unified auth-check endpoint for login and registration
users.post('/auth-check', async (c) => {
  try {
    const dto: SendCodeDto = await c.req.json();
    const userRepo = getUserRepo(c.env.DB);
    
    // Find user by email or phone number
    const user = dto.isEmail
      ? await userRepo.findByEmail(dto.identifier)
      : await userRepo.findByPhoneNumber(dto.identifier);
    
    const response: Response<{exists: boolean, userId?: number}> = {
      success: true,
      message: 'User existence check completed',
      data: { exists: !!user, userId: user?.id || undefined }
    };
    return c.json(response);
  } catch (error) {
    console.error('Error in auth-check:', error);
    const response: Response = {
      success: false,
      message: 'Failed to process auth check'
    };
    return c.json(response, 500);
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
      const response: Response<{userId: number}> = {
        success: true,
        message: 'User found successfully',
        data: { userId: user.id }
      };
      return c.json(response);
    } else {
      const response: Response = {
        success: false,
        message: 'User not found'
      };
      return c.json(response, 404);
    }
  } catch (error) {
    console.error('Error finding user:', error);
    const response: Response = {
      success: false,
      message: 'Failed to find user'
    };
    return c.json(response, 500);
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
      const response: Response = {
        success: false,
        message: 'User already exists'
      };
      return c.json(response, 409); // Conflict status
    }
    
    // Create the user
    const newUser = await userRepo.create({
      name: userData.name,
      email: userData.email,
      phone_number: userData.phoneNumber,
      auth_provider: userData.authProvider || 'Registration',
      provider_id: userData.providerId
    });
    
    const response: Response<{userId: number}> = {
      success: true,
      message: 'User created successfully',
      data: { userId: newUser.id }
    };
    return c.json(response, 201); // Created status
  } catch (error) {
    console.error('Error creating user:', error);
    const response: Response = {
      success: false,
      message: 'Failed to create user'
    };
    return c.json(response, 500);
  }
});

export default users;