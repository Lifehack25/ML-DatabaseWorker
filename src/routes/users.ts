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
users.post('/exist-check', async (c) => {
  try {
    const dto: SendCodeDto = await c.req.json();
    const userRepo = getUserRepo(c.env.DB);
    
    // Find user by email or phone number
    const user = dto.isEmail
      ? await userRepo.findByEmail(dto.identifier)
      : await userRepo.findByPhoneNumber(dto.identifier);
    
    const response: Response<boolean> = {
      success: true,
      message: 'User existence check completed',
      data: !!user
    };
    return c.json(response);
  } catch (error) {
    console.error('Error in auth-check:', error);
    const response: Response<boolean> = {
      success: false,
      message: 'Failed to process auth check',
      data: false
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
      const response: Response<number> = {
        success: true,
        message: 'User found successfully',
        data: user.id
      };
      return c.json(response);
    } else {
      const response: Response<number> = {
        success: true,
        message: 'User not found',
        data: 0
      };
      return c.json(response, 404);
    }
  } catch (error) {
    console.error('Error finding user:', error);
    const response: Response<number> = {
      success: false,
      message: 'Failed to find user',
      data: 0
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
      const response: Response<number> = {
        success: false,
        message: 'User already exists',
        data: 0
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
    
    const response: Response<number> = {
      success: true,
      message: 'User created successfully',
      data: newUser.id
    };
    return c.json(response, 201); // Created status
  } catch (error) {
    console.error('Error creating user:', error);
    const response: Response<number> = {
      success: false,
      message: 'Failed to create user',
      data: 0
    };
    return c.json(response, 500);
  }
});

// Find user by OAuth provider
users.post('/find-by-provider', async (c) => {
  try {
    const { authProvider, providerId } = await c.req.json();
    const userRepo = getUserRepo(c.env.DB);
    
    const user = await userRepo.findByProvider(authProvider, providerId);
    
    if (user) {
      const response: Response<number> = {
        success: true,
        message: 'User found successfully',
        data: user.id
      };
      return c.json(response);
    } else {
      const response: Response<number> = {
        success: true,
        message: 'User not found',
        data: 0
      };
      return c.json(response, 404);
    }
  } catch (error) {
    console.error('Error finding user by provider:', error);
    const response: Response<number> = {
      success: false,
      message: 'Failed to find user by provider',
      data: 0
    };
    return c.json(response, 500);
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
      const response: Response<boolean> = {
        success: false,
        message: 'User not found',
        data: false
      };
      return c.json(response, 404);
    }
    
    // Link the provider
    await userRepo.linkProvider(userId, authProvider, providerId);
    
    const response: Response<boolean> = {
      success: true,
      message: 'OAuth provider linked successfully',
      data: true
    };
    return c.json(response);
  } catch (error) {
    console.error('Error linking provider:', error);
    const response: Response<boolean> = {
      success: false,
      message: 'Failed to link OAuth provider',
      data: false
    };
    return c.json(response, 500);
  }
});

export default users;