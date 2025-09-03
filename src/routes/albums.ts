import { Hono } from 'hono';
import { LockRepository } from '../repositories/lockRepository';
import { MediaObjectRepository } from '../repositories/mediaObjectRepository';
import { UserRepository } from '../repositories/userRepository';
import { ApiResponse, Lock, MediaObject, User } from '../types';

type Bindings = {
  DB: D1Database;
};

const albums = new Hono<{ Bindings: Bindings }>();

// API endpoints will be added here when requested

export default albums;