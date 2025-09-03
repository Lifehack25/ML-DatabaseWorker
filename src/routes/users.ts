import { Hono } from 'hono';
import { UserRepository } from '../repositories/userRepository';
import { CreateUserRequest, ApiResponse, User } from '../types';

type Bindings = {
  DB: D1Database;
};

const users = new Hono<{ Bindings: Bindings }>();

// API endpoints will be added here when requested

export default users;