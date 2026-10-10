import { ethers } from 'ethers';

/**
 * Generates a mock transaction hash for simulation mode.
 * Safe to import in both server and client environments.
 */
export function generateMockTxHash(): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

/**
 * Converts any string ID or SHA-256 string to a valid bytes32 hex string.
 */
export function toBytes32Hash(input: string): string {
  if (input.startsWith('0x') && input.length === 66) {
    return input;
  }
  if (!input.startsWith('0x') && input.length === 64) {
    return '0x' + input;
  }
  return ethers.keccak256(ethers.toUtf8Bytes(input));
}
