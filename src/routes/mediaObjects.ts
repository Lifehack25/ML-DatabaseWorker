import { Hono } from 'hono';
import { MediaObjectRepository } from '../repositories/mediaObjectRepository';
import { LockRepository } from '../repositories/lockRepository';
import { CreateMediaObjectRequest, UpdateMediaObjectRequest, ApiResponse, MediaObject } from '../types';

type Bindings = {
  DB: D1Database;
};

const mediaObjects = new Hono<{ Bindings: Bindings }>();

// API endpoints will be added here when requested

export default mediaObjects;