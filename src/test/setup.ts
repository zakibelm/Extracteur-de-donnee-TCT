/**
 * Configuration globale pour Vitest
 */

import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Nettoie après chaque test
afterEach(() => {
  cleanup();
});

// Mock de localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

global.localStorage = localStorageMock as any;

// Mock de fetch global
global.fetch = vi.fn();

// Mock de console pour réduire le bruit dans les tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: process.env.DEBUG_TESTS ? console.log : vi.fn(),
};
