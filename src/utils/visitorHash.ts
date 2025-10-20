/**
 * Utility functions for generating visitor hashes for unique visitor tracking
 */

/**
 * Generates a SHA-256 hash from visitor IP and User-Agent
 * @param ip - Visitor IP address
 * @param userAgent - Visitor User-Agent string
 * @returns Hex-encoded SHA-256 hash
 */
export async function generateVisitorHash(ip: string, userAgent: string): Promise<string> {
  // Combine IP and User-Agent for hashing
  const combined = `${ip}|${userAgent}`;

  // Convert string to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);

  // Generate SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert hash to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Builds the complete KV key for visitor tracking
 * @param lockId - The lock ID being viewed
 * @param visitorHash - The SHA-256 hash of the visitor
 * @returns KV key in format: visitor:<lockId>:<visitorHash>
 */
export function buildVisitorKVKey(lockId: number, visitorHash: string): string {
  return `visitor:${lockId}:${visitorHash}`;
}
