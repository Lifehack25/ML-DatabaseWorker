import { Hono } from 'hono';
import { LockRepository } from '../repositories/lockRepository';
import { UserRepository } from '../repositories/userRepository';
import {
  CreateLockRequest,
  UpdateLockRequest,
  UpdateLockNameRequest,
  UpdateNotificationPreferenceRequest,
  ModifyLockSealRequest,
  Lock,
  LockDto,
  LockConnectUserDto,
  Response,
} from '../types';

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
  NotifiedWhenScanned: typeof lock.notified_when_scanned === 'number'
    ? lock.notified_when_scanned === 1
    : Boolean(lock.notified_when_scanned),
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

// PATCH /locks/name - Update lock name
locks.patch('/name', async (c) => {
  try {
    const dto = (await c.req.json()) as UpdateLockNameRequest;

    if (!dto?.lockId || !dto.newName?.trim()) {
      return c.json({
        success: false,
        message: 'Both lockId and newName are required',
      }, 400);
    }

    const lockRepo = getLockRepo(c.env.DB);
    const updatedLock = await lockRepo.update(dto.lockId, { lock_name: dto.newName.trim() });

    return c.json({
      success: true,
      message: 'Lock name updated successfully',
      data: mapLockToDto(updatedLock),
    });
  } catch (error) {
    console.error('Error updating lock name:', error);
    return c.json({
      success: false,
      message: 'Failed to update lock name',
    }, 500);
  }
});

// PATCH /locks/notification - Update notification preference
locks.patch('/notification', async (c) => {
  try {
    const dto = (await c.req.json()) as UpdateNotificationPreferenceRequest;

    if (!dto?.lockId || typeof dto.notifiedWhenScanned !== 'boolean') {
      return c.json({
        success: false,
        message: 'lockId and notifiedWhenScanned are required',
      }, 400);
    }

    const lockRepo = getLockRepo(c.env.DB);
    const updatedLock = await lockRepo.update(dto.lockId, {
      notified_when_scanned: dto.notifiedWhenScanned,
    });

    return c.json({
      success: true,
      message: 'Notification preference updated successfully',
      data: mapLockToDto(updatedLock),
    });
  } catch (error) {
    console.error('Error updating notification preference:', error);
    return c.json({
      success: false,
      message: 'Failed to update notification preference',
    }, 500);
  }
});

const formatDateOnly = (date: Date): string => date.toISOString().split('T')[0];

// PATCH /locks/seal - Toggle seal state
locks.patch('/seal', async (c) => {
  try {
    const dto = (await c.req.json()) as ModifyLockSealRequest;

    if (!dto?.lockId) {
      return c.json({
        success: false,
        message: 'lockId is required',
      }, 400);
    }

    const lockRepo = getLockRepo(c.env.DB);
    const existingLock = await lockRepo.findById(dto.lockId);

    if (!existingLock) {
      return c.json({
        success: false,
        message: 'Lock not found',
      }, 404);
    }

    const isCurrentlySealed = Boolean(existingLock.seal_date);
    const updatedLock = await lockRepo.update(dto.lockId, {
      seal_date: isCurrentlySealed ? null : formatDateOnly(new Date()),
    });

    return c.json({
      success: true,
      message: isCurrentlySealed ? 'Lock unsealed successfully' : 'Lock sealed successfully',
      data: mapLockToDto(updatedLock),
    });
  } catch (error) {
    console.error('Error toggling seal state:', error);
    return c.json({
      success: false,
      message: 'Failed to update seal state',
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
        lock_name: `Memory Lock`,
        album_title: `Romeo & Juliet`,
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
