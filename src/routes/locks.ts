import { Hono } from 'hono';
import { LockRepository } from '../repositories/lockRepository';
import { UserRepository } from '../repositories/userRepository';
import { CreateLockRequest, UpdateLockRequest, ApiResponse, Lock } from '../types';

type Bindings = {
  DB: D1Database;
};

const locks = new Hono<{ Bindings: Bindings }>();

// API endpoints will be added here when requested

export default locks;