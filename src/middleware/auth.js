export async function authenticateWorkerApiKey(c, next) {
    // Skip authentication for public endpoints
    if (c.req.path === '/public/health' || c.req.path === '/' || c.req.path.startsWith('/album')) {
        return next();
    }
    const providedApiKey = c.req.header('Worker-API-Key');
    const expectedApiKey = c.env.WORKER_API_KEY;
    if (!providedApiKey) {
        return c.json({ error: 'Worker API key is required' }, 401);
    }
    if (providedApiKey !== expectedApiKey) {
        return c.json({ error: 'Invalid Worker API key' }, 401);
    }
    // API key is valid, proceed to next middleware/handler
    await next();
}
// Export alias for backwards compatibility
export const authMiddleware = authenticateWorkerApiKey;
