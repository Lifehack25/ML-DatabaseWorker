import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authenticateWorkerApiKey } from './middleware/auth';
import users from './routes/users';
import locks from './routes/locks';
import mediaObjects from './routes/mediaObjects';
import albums from './routes/albums';
const app = new Hono();
// Middleware
app.use('*', logger());
app.use('/*', cors({
    origin: ['http://localhost:3000', 'https://album.memorylocks.com'],
    allowHeaders: ['Content-Type', 'Authorization', 'Worker-API-Key'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
// Apply Worker API Key authentication to all routes except public ones
app.use('*', authenticateWorkerApiKey);
// Public health check endpoint (no authentication required)
app.get('/public/health', (c) => {
    return c.json({
        success: true,
        message: 'ML-DatabaseWorker is running',
        version: '1.0.1',
        timestamp: new Date().toISOString(),
        environment: c.env.ENVIRONMENT || 'development'
    });
});
// Root endpoint (no authentication required)
app.get('/', (c) => {
    return c.json({
        success: true,
        message: 'ML-DatabaseWorker is running with auto-deployment',
        version: '1.0.1',
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
app.route('/api/locks', locks); // For CreateLocks tool compatibility
app.route('/media-objects', mediaObjects);
app.route('/albums', albums);
app.route('/album', albums);
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
