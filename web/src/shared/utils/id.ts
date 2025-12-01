/**
 * ID utility
 * Generates NanoID-compatible identifiers with crypto-grade randomness
 */

import { nanoid } from 'nanoid';

export const DEFAULT_ID_LENGTH = 21;

/**
 * Generates a NanoID identifier
 * Uses the browser's crypto API when available, falls back to Math.random
 * @returns NanoID string
 */
export function generateId(length: number = DEFAULT_ID_LENGTH): string {
  try {
    return nanoid(length);
  } catch {
    // Fallback for environments where crypto is unavailable
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-';
    const alphabetLength = alphabet.length;
    let id = '';
    for (let i = 0; i < length; i += 1) {
      const randomIndex = Math.floor(Math.random() * alphabetLength);
      id += alphabet[randomIndex];
    }
    return id;
  }
}

