import Hashids from 'hashids';

// Cache for Hashids instances keyed by salt+minLength combination
const hashidsCache = new Map<string, Hashids>();

function getHashidsInstance(salt: string, minLength: number): Hashids {
  const cacheKey = `${salt}_${minLength}`;

  if (!hashidsCache.has(cacheKey)) {
    hashidsCache.set(cacheKey, new Hashids(salt, minLength));
  }

  return hashidsCache.get(cacheKey)!;
}

export function encodeId(id: number, salt: string, minLength: number): string {
  return getHashidsInstance(salt, minLength).encode(id);
}

export function decodeId(hash: string, salt: string, minLength: number): number | null {
  const decoded = getHashidsInstance(salt, minLength).decode(hash);
  if (decoded.length === 0) {
    return null;
  }
  return Number(decoded[0]);
}

export function isHashedId(value: string, salt: string, minLength: number): boolean {
  // Check if it's a valid hashed ID (alphanumeric, min 6 chars)
  return /^[a-zA-Z0-9]{6,}$/.test(value) && decodeId(value, salt, minLength) !== null;
}
