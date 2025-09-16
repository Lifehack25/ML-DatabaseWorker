import { Hono } from 'hono';
import { LockRepository } from '../repositories/lockRepository';
import { UserRepository } from '../repositories/userRepository';
import { CreateLockRequest, UpdateLockRequest, Lock, LockDto, LockConnectUserDto, Response } from '../types';

type Bindings = {
  DB: D1Database;
};

const locks = new Hono<{ Bindings: Bindings }>();

// Helper function to get LockRepository instance
const getLockRepo = (db: D1Database) => new LockRepository(db);

// Helper function to convert Lock entity to LockDto
const mapLockToDto = (lock: Lock): LockDto => ({
  LockId: lock.id,
  LockName: lock.lock_name,
  SealDate: lock.seal_date || undefined,
  NotifiedWhenScanned: lock.notified_when_scanned,
  ScanCount: lock.scan_count
});

// GET /locks/user/{userId} - Get all locks for a specific user
locks.get('/user/:userId', async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'));
    
    if (isNaN(userId)) {
      return c.json({
        success: false,
        message: 'Invalid user ID'
      }, 400);
    }

    const lockRepo = getLockRepo(c.env.DB);
    const locks = await lockRepo.findByUserId(userId);
    
    // Convert to DTOs
    const lockDtos = locks.map(mapLockToDto);
    
    return c.json({
      success: true,
      message: `Retrieved ${lockDtos.length} locks for user ${userId}`,
      data: lockDtos
    });
  } catch (error) {
    console.error('Error fetching user locks:', error);
    return c.json({
      success: false,
      message: 'Failed to fetch user locks'
    }, 500);
  }
});

// POST /locks/connect - Connect a lock to a user
locks.post('/connect', async (c) => {
  try {
    const dto: LockConnectUserDto = await c.req.json();
    
    if (!dto.userId || !dto.lockId) {
      return c.json({
        success: false,
        message: 'Both userId and lockId are required'
      }, 400);
    }

    const lockRepo = getLockRepo(c.env.DB);
    
    // Check if lock exists
    const existingLock = await lockRepo.findById(dto.lockId);
    if (!existingLock) {
      return c.json({
        success: false,
        message: 'Lock not found'
      }, 404);
    }

    // Check if user exists
    const userRepo = new UserRepository(c.env.DB);
    const user = await userRepo.findById(dto.userId);
    if (!user) {
      return c.json({
        success: false,
        message: 'User not found'
      }, 404);
    }

    // Update lock to connect it to the user
    const updatedLock = await lockRepo.update(dto.lockId, { user_id: dto.userId });
    
    const response: Response = {
      success: true,
      message: 'Lock successfully connected to user'
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Error connecting lock to user:', error);
    return c.json({
      success: false,
      message: 'Failed to connect lock to user'
    }, 500);
  }
});

// POST /api/locks/generate/{totalLocks} - Bulk create locks for CreateLocks tool
locks.post('/create/:totalLocks', async (c) => {
  try {
    const totalLocks = parseInt(c.req.param('totalLocks'));
    
    if (isNaN(totalLocks) || totalLocks <= 0 || totalLocks > 10000) {
      return c.json({
        success: false,
        message: 'Invalid totalLocks parameter. Must be between 1 and 10000.'
      }, 400);
    }

    const lockRepo = getLockRepo(c.env.DB);
    
    // Get the highest existing lock ID to continue from there
    const lastLock = await lockRepo.getLastLock();
    const startId = lastLock ? lastLock.id + 1 : 1;
    
    console.log(`Creating ${totalLocks} locks starting from ID ${startId}`);
    
    const createdLocks = [];
    const batch = [];
    const batchSize = 100; // Process in batches to avoid overwhelming the database
    
    for (let i = 0; i < totalLocks; i++) {
      const lockId = startId + i;
      
      batch.push({
        lock_name: `Memory Lock ${lockId}`,
        album_title: `Album ${lockId}`,
        seal_date: undefined,
        user_id: undefined,
        notified_when_scanned: false
      });
      
      // Process batch when it reaches batchSize or at the end
      if (batch.length === batchSize || i === totalLocks - 1) {
        for (const lockData of batch) {
          try {
            const newLock = await lockRepo.create(lockData);
            createdLocks.push(newLock);
          } catch (error) {
            console.error(`Failed to create lock ${lockData.lock_name}:`, error);
            // Continue with other locks even if one fails
          }
        }
        batch.length = 0; // Clear the batch
      }
    }
    
    const response: Response = {
      success: true,
      message: `Successfully created ${createdLocks.length} locks (${startId} to ${startId + createdLocks.length - 1})`
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Error creating bulk locks:', error);
    return c.json({
      success: false,
      message: 'Failed to create locks'
    }, 500);
  }
});

export default locks;