import { describe, it, expect } from 'vitest';
import { hashPassword } from '../src/utils/auth.js';

describe('auth utils', () => {
  it('hashes password to base64', () => {
    expect(hashPassword('secret')).toBe('c2VjcmV0');
  });
  // TODO: Add more test cases
});
