import Hashids from 'hashids';

const SALT = 'GzFbxMxQkArX1cLMo3tnGmpNxL5lUOROXXum5xfhiPU=';
const MIN_LENGTH = 6;

const hashids = new Hashids(SALT, MIN_LENGTH);

export function encodeId(id: number): string {
  return hashids.encode(id);
}

export function decodeId(hash: string): number | null {
  const decoded = hashids.decode(hash);
  if (decoded.length === 0) {
    return null;
  }
  return Number(decoded[0]);
}

export function isHashedId(value: string): boolean {
  // Check if it's a valid hashed ID (alphanumeric, min 6 chars)
  return /^[a-zA-Z0-9]{6,}$/.test(value) && decodeId(value) !== null;
}
