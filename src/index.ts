import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import users from './routes/users';
import locks from './routes/locks';
import mediaObjects from './routes/mediaObjects';
import albums from './routes/albums';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', logger());
app.use('/*', cors({
  origin: ['http://localhost:3000', 'https://album.memorylocks.com'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'ML-DatabaseWorker is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'development'
  });
});

// API Status endpoint
app.get('/api/status', (c) => {
  return c.json({
    success: true,
    status: 'healthy',
    database: 'connected',
    timestamp: new Date().toISOString()
  });
});

// Mount route modules (ready for endpoints)
app.route('/users', users);
app.route('/locks', locks);
app.route('/media-objects', mediaObjects);
app.route('/albums', albums);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Endpoint not found',
    message: 'The requested resource does not exist'
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  }, 500);
});

export default app;