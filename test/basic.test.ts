import { describe, it, expect } from 'vitest';
import { User, CreateUserDto, Response } from '../src/types';

describe('Worker structure tests', () => {
  it('should have correct environment setup', () => {
    expect(1 + 1).toBe(2);
  });

  it('should validate User type definition', () => {
    const mockUser: User = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      phone_number: null,
      auth_provider: 'email',
      provider_id: null,
      email_verified: false,
      phone_verified: false,
      created_at: new Date().toISOString(),
      last_login_at: null,
      has_premium_storage: false
    };

    expect(mockUser.id).toBeTypeOf('number');
    expect(mockUser.name).toBeTypeOf('string');
    expect(mockUser.auth_provider).toBeTypeOf('string');
    expect(mockUser.email_verified).toBeTypeOf('boolean');
  });

  it('should validate CreateUserDto type', () => {
    const mockRequest: CreateUserDto = {
      name: 'New User',
      email: 'new@example.com',
      authProvider: 'email'
    };

    expect(mockRequest.name).toBeTypeOf('string');
    expect(mockRequest.email).toBeTypeOf('string');
  });

  it('should validate Response type', () => {
    const mockResponse: Response<User> = {
      Success: true,
      Data: {
        id: 1,
        name: 'Test',
        email: 'test@example.com',
        phone_number: null,
        auth_provider: 'email',
        provider_id: null,
        email_verified: false,
        phone_verified: false,
        created_at: '2024-01-01T00:00:00Z',
        last_login_at: null,
        has_premium_storage: false
      },
      Message: 'Success'
    };

    expect(mockResponse.Success).toBe(true);
    expect(mockResponse.Data?.name).toBe('Test');
  });
});