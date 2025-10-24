import { Hono } from 'hono';
import { LockRepository } from '../repositories/lockRepository';
import { UserRepository } from '../repositories/userRepository';
import { decodeId } from '../utils/hashids';
import { rateLimiters } from '../middleware/rateLimit';
import {
  CreateLockRequest,
  UpdateLockRequest,
  UpdateLockNameRequest,
  ModifyLockSealRequest,
  Lock,
  LockDto,
  LockConnectUserDto,
  Response,
} from '../types';

type Bindings = {
  DB: D1Database;
  HASHIDS_SALT: string;
  HASHIDS_MIN_LENGTH: string;
};

const locks = new Hono<{ Bindings: Bindings }>();

// Helper function to get LockRepository instance
const getLockRepo = (db: D1Database) => new LockRepository(db);

// Helper function to convert Lock entity to LockDto
const mapLockToDto = (lock: Lock): LockDto => ({
  LockId: lock.id,
  LockName: lock.lock_name,
  SealDate: lock.seal_date || undefined,
  ScanCount: lock.scan_count,
  UpgradedStorage: Boolean(lock.upgraded_storage)
});

// GET /locks/user/{userId} - Get all locks for a specific user
// Rate limited to 120 reads per minute
locks.get('/user/:userId', rateLimiters.read, async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'));
    
    if (isNaN(userId)) {
      return c.json({
        Success: false,
        Message: 'Invalid user ID'
      }, 400);
    }

    const lockRepo = getLockRepo(c.env.DB);
    const locks = await lockRepo.findByUserId(userId);
    
    // Convert to DTOs
    const lockDtos = locks.map(mapLockToDto);
    
    return c.json({
      Success: true,
      Message: `Retrieved ${lockDtos.length} locks for user ${userId}`,
      Data: lockDtos
    });
  } catch (error) {
    console.error('Error fetching user locks:', error);
    return c.json({
      Success: false,
      Message: 'Failed to fetch user locks'
    }, 500);
  }
});

// POST /locks/connect - Connect a lock to a user
// Rate limited to 60 API calls per minute
locks.post('/connect', rateLimiters.api, async (c) => {
  try {
    const dto: LockConnectUserDto = await c.req.json();

    if (!dto.userId || !dto.hashedLockId) {
      return c.json({
        Success: false,
        Message: 'Both userId and hashedLockId are required'
      }, 400);
    }

    // Get Hashids configuration from secrets
    const salt = c.env.HASHIDS_SALT;
    const minLength = parseInt(c.env.HASHIDS_MIN_LENGTH || '6');

    // Decode the hashed lock ID
    const lockId = decodeId(dto.hashedLockId, salt, minLength);
    if (lockId === null) {
      return c.json({
        Success: false,
        Message: 'Invalid hashed lock ID'
      }, 400);
    }

    const lockRepo = getLockRepo(c.env.DB);

    // Check if lock exists
    const existingLock = await lockRepo.findById(lockId);
    if (!existingLock) {
      return c.json({
        Success: false,
        Message: 'Lock not found'
      }, 404);
    }

    // Check if user exists
    const userRepo = new UserRepository(c.env.DB);
    const user = await userRepo.findById(dto.userId);
    if (!user) {
      return c.json({
        Success: false,
        Message: 'User not found'
      }, 404);
    }

    // Update lock to connect it to the user
    const updatedLock = await lockRepo.update(lockId, { user_id: dto.userId });

    return c.json({
      Success: true,
      Message: 'Lock successfully connected to user',
      Data: mapLockToDto(updatedLock)
    });
  } catch (error) {
    console.error('Error connecting lock to user:', error);
    return c.json({
      Success: false,
      Message: 'Failed to connect lock to user'
    }, 500);
  }
});

// PATCH /locks/name - Update lock name
// Rate limited to 60 API calls per minute
locks.patch('/name', rateLimiters.api, async (c) => {
  try {
    const dto = (await c.req.json()) as UpdateLockNameRequest;

    if (!dto?.lockId || !dto.newName?.trim()) {
      return c.json({
        Success: false,
        Message: 'Both lockId and newName are required',
      }, 400);
    }

    const lockRepo = getLockRepo(c.env.DB);
    const updatedLock = await lockRepo.update(dto.lockId, { lock_name: dto.newName.trim() });

    return c.json({
      Success: true,
      Message: 'Lock name updated successfully',
      Data: mapLockToDto(updatedLock),
    });
  } catch (error) {
    console.error('Error updating lock name:', error);
    return c.json({
      Success: false,
      Message: 'Failed to update lock name',
    }, 500);
  }
});

const formatDateOnly = (date: Date): string => date.toISOString().split('T')[0];

// PATCH /locks/seal - Toggle seal state
// Rate limited to 60 API calls per minute
locks.patch('/seal', rateLimiters.api, async (c) => {
  try {
    const dto = (await c.req.json()) as ModifyLockSealRequest;

    if (!dto?.lockId) {
      return c.json({
        Success: false,
        Message: 'lockId is required',
      }, 400);
    }

    const lockRepo = getLockRepo(c.env.DB);
    const existingLock = await lockRepo.findById(dto.lockId);

    if (!existingLock) {
      return c.json({
        Success: false,
        Message: 'Lock not found',
      }, 404);
    }

    const isCurrentlySealed = Boolean(existingLock.seal_date);
    const updatedLock = await lockRepo.update(dto.lockId, {
      seal_date: isCurrentlySealed ? null : formatDateOnly(new Date()),
    });

    return c.json({
      Success: true,
      Message: isCurrentlySealed ? 'Lock unsealed successfully' : 'Lock sealed successfully',
      Data: mapLockToDto(updatedLock),
    });
  } catch (error) {
    console.error('Error toggling seal state:', error);
    return c.json({
      Success: false,
      Message: 'Failed to update seal state',
    }, 500);
  }
});

// PATCH /locks/upgrade-storage - Upgrade lock to Tier 2 storage
// Rate limited to 60 API calls per minute
locks.patch('/upgrade-storage', rateLimiters.api, async (c) => {
  try {
    const dto = await c.req.json();

    if (!dto?.lockId) {
      return c.json({
        Success: false,
        Message: 'lockId is required',
      }, 400);
    }

    const lockRepo = getLockRepo(c.env.DB);
    const existingLock = await lockRepo.findById(dto.lockId);

    if (!existingLock) {
      return c.json({
        Success: false,
        Message: 'Lock not found',
      }, 404);
    }

    const updatedLock = await lockRepo.update(dto.lockId, {
      upgraded_storage: true,
    });

    return c.json({
      Success: true,
      Message: 'Storage upgraded successfully',
      Data: mapLockToDto(updatedLock),
    });
  } catch (error) {
    console.error('Error upgrading storage:', error);
    return c.json({
      Success: false,
      Message: 'Failed to upgrade storage',
    }, 500);
  }
});

// GET /locks/:id - Get a single lock by ID
// Rate limited to 120 reads per minute
locks.get('/:id', rateLimiters.read, async (c) => {
  try {
    const lockId = parseInt(c.req.param('id'));

    if (isNaN(lockId)) {
      return c.json({
        Success: false,
        Message: 'Invalid lock ID'
      }, 400);
    }

    const lockRepo = getLockRepo(c.env.DB);
    const lock = await lockRepo.findById(lockId);

    if (!lock) {
      return c.json({
        Success: false,
        Message: 'Lock not found'
      }, 404);
    }

    return c.json({
      Success: true,
      Message: 'Lock retrieved successfully',
      Data: mapLockToDto(lock)
    });
  } catch (error) {
    console.error('Error fetching lock:', error);
    return c.json({
      Success: false,
      Message: 'Failed to fetch lock'
    }, 500);
  }
});

// GET /locks/:id/validation-data - Get combined lock and media data for validation
// Rate limited to 120 reads per minute
locks.get('/:id/validation-data', rateLimiters.read, async (c) => {
  try {
    const lockId = parseInt(c.req.param('id'));

    if (isNaN(lockId)) {
      return c.json({
        Success: false,
        Message: 'Invalid lock ID'
      }, 400);
    }

    const lockRepo = getLockRepo(c.env.DB);
    const { MediaObjectRepository } = await import('../repositories/mediaObjectRepository');
    const mediaRepo = new MediaObjectRepository(c.env.DB);

    // Fetch lock and media data in parallel
    const [lock, mediaObjects] = await Promise.all([
      lockRepo.findById(lockId),
      mediaRepo.findByLockId(lockId)
    ]);

    if (!lock) {
      return c.json({
        Success: false,
        Message: 'Lock not found'
      }, 404);
    }

    // Map media objects to minimal format needed for validation
    const media = mediaObjects.map(m => ({
      id: m.id,
      isImage: Boolean(m.is_image),
      isMainImage: Boolean(m.is_main_picture),
      durationSeconds: m.duration_seconds || null
    }));

    return c.json({
      Success: true,
      Message: 'Validation data retrieved successfully',
      Data: {
        lock: {
          id: lock.id,
          upgradedStorage: Boolean(lock.upgraded_storage)
        },
        media: media
      }
    });
  } catch (error) {
    console.error('Error fetching validation data:', error);
    return c.json({
      Success: false,
      Message: 'Failed to fetch validation data'
    }, 500);
  }
});

// POST /api/locks/generate/{totalLocks} - Bulk create locks for CreateLocks tool
// Rate limited to 5 batch operations per minute
locks.post('/create/:totalLocks', rateLimiters.batch, async (c) => {
  try {
    const totalLocks = parseInt(c.req.param('totalLocks'));
    
    if (isNaN(totalLocks) || totalLocks <= 0 || totalLocks > 10000) {
      return c.json({
        Success: false,
        Message: 'Invalid totalLocks parameter. Must be between 1 and 10000.'
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
        user_id: undefined
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
      Success: true,
      Message: `Successfully created ${createdLocks.length} locks (${startId} to ${startId + createdLocks.length - 1})`
    };

    return c.json(response);
  } catch (error) {
    console.error('Error creating bulk locks:', error);
    return c.json({
      Success: false,
      Message: 'Failed to create locks'
    }, 500);
  }
});

export default locks;
