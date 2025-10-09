// TypeScript interfaces matching the .NET API models with snake_case naming

export interface User {
  id: number;
  name?: string;
  email?: string;
  phone_number?: string;
  auth_provider: string;
  provider_id?: string;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string; // ISO date string
  last_login_at?: string; // ISO date string
  has_premium_storage: boolean;
}

export interface Lock {
  id: number;
  lock_name: string;
  album_title: string;
  seal_date?: string; // ISO date string (YYYY-MM-DD)
  notified_when_scanned: boolean;
  scan_count: number;
  created_at: string; // ISO date string
  user_id?: number;
}

export interface MediaObject {
  id: number;
  lock_id: number;
  cloudflare_id: string;
  url: string;
  file_name?: string;
  media_type: string;
  is_main_picture: boolean;
  created_at: string; // ISO date string
  display_order: number;
}

// Request/Response DTOs
export interface ValidatedIdentifier {
  isEmail: boolean;
  identifier: string;
}

export interface SendCodeDto {
  isLogin: boolean;
  isEmail: boolean;
  identifier: string;
}

export interface CreateUserDto {
  name: string;
  email?: string;
  phoneNumber?: string;
  authProvider?: string;
  providerId?: string;
}

export interface UpdateAuthMetadataRequest {
  userId: number;
  emailVerified?: boolean | null;
  lastLoginAt?: string;
}

export interface CreateLockRequest {
  lock_name?: string;
  album_title?: string;
  seal_date?: string | null; // ISO date string YYYY-MM-DD
  notified_when_scanned?: boolean;
  user_id?: number;
}

export interface UpdateLockRequest {
  lock_name?: string;
  album_title?: string;
  seal_date?: string | null; // ISO date string YYYY-MM-DD or null to clear
  notified_when_scanned?: boolean;
}

export interface UpdateLockNameRequest {
  lockId: number;
  newName: string;
}

export interface UpdateNotificationPreferenceRequest {
  lockId: number;
  notifiedWhenScanned: boolean;
}

export interface ModifyLockSealRequest {
  lockId: number;
}

// Lock DTOs matching .NET API structure
export interface LockDto {
  LockId: number;
  LockName: string;
  SealDate?: string; // ISO date string (YYYY-MM-DD) - nullable DateOnly from .NET
  NotifiedWhenScanned: boolean;
  ScanCount: number;
}

export interface LockConnectUserDto {
  userId: number;
  hashedLockId: string;
}

// API Response wrapper types
export interface Response<T = any> {
  Success: boolean;
  Message?: string;
  Data?: T;
}

export interface Response {
  Success: boolean;
  Message?: string;
}

// Database result types
export interface D1Result<T = any> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    changes?: number;
    last_row_id?: number;
    rows_read?: number;
    rows_written?: number;
  };
}
