/**
 * Tests pour les utilitaires de retry
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  retryWithBackoff,
  retryFetch,
  retryFetchJSON,
  CircuitBreaker,
} from './retry';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devrait réussir du premier coup si pas d\'erreur', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(fn, { maxAttempts: 3 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('devrait retry en cas d\'erreur réseau', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ name: 'NetworkError' })
      .mockRejectedValueOnce({ name: 'NetworkError' })
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelay: 10, // Délai court pour les tests
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('devrait lancer l\'erreur après maxAttempts', async () => {
    const fn = vi.fn().mockRejectedValue({ name: 'NetworkError' });

    await expect(
      retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelay: 10,
      })
    ).rejects.toEqual({ name: 'NetworkError' });

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('ne devrait pas retry si shouldRetry retourne false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Custom error'));

    await expect(
      retryWithBackoff(fn, {
        maxAttempts: 3,
        shouldRetry: () => false,
      })
    ).rejects.toThrow('Custom error');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('devrait appeler onRetry avant chaque retry', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ name: 'NetworkError' })
      .mockResolvedValue('success');

    const onRetry = vi.fn();

    await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelay: 10,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, { name: 'NetworkError' });
  });
});

describe('retryFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('devrait fetch avec succès', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const response = await retryFetch('https://api.example.com/data');

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('devrait retry sur erreur 500', async () => {
    const errorResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    };

    const successResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    };

    (global.fetch as any)
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValue(successResponse);

    const response = await retryFetch('https://api.example.com/data', {}, {
      maxAttempts: 3,
      initialDelay: 10,
    });

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('devrait retry sur erreur 429 (rate limit)', async () => {
    const rateLimitResponse = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    };

    const successResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    };

    (global.fetch as any)
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValue(successResponse);

    const response = await retryFetch('https://api.example.com/data', {}, {
      maxAttempts: 3,
      initialDelay: 10,
    });

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('ne devrait pas retry sur erreur 400', async () => {
    const errorResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    };

    (global.fetch as any).mockResolvedValue(errorResponse);

    await expect(
      retryFetch('https://api.example.com/data', {}, {
        maxAttempts: 3,
        initialDelay: 10,
      })
    ).rejects.toThrow('HTTP 400');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('retryFetchJSON', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('devrait parser le JSON automatiquement', async () => {
    const mockData = { id: 1, name: 'Test' };
    const mockResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockData),
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const data = await retryFetchJSON('https://api.example.com/data');

    expect(data).toEqual(mockData);
  });
});

describe('CircuitBreaker', () => {
  it('devrait être CLOSED initialement', () => {
    const breaker = new CircuitBreaker(3, 5000);

    expect(breaker.getState()).toBe('closed');
  });

  it('devrait passer à OPEN après le seuil d\'échecs', async () => {
    const breaker = new CircuitBreaker(3, 5000);
    const fn = vi.fn().mockRejectedValue(new Error('Service error'));

    // 3 échecs consécutifs
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();

    expect(breaker.getState()).toBe('open');
  });

  it('devrait rejeter immédiatement quand OPEN', async () => {
    const breaker = new CircuitBreaker(2, 5000);
    const fn = vi.fn().mockRejectedValue(new Error('Service error'));

    // Force l'ouverture du circuit
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();

    expect(breaker.getState()).toBe('open');

    // Devrait rejeter sans appeler fn
    await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');

    // fn ne devrait avoir été appelé que 2 fois (pas 3)
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('devrait se réinitialiser manuellement', async () => {
    const breaker = new CircuitBreaker(2, 5000);
    const fn = vi.fn().mockRejectedValue(new Error('Service error'));

    // Force l'ouverture
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();

    expect(breaker.getState()).toBe('open');

    // Reset
    breaker.reset();

    expect(breaker.getState()).toBe('closed');
  });

  it('devrait réussir après succès en HALF-OPEN', async () => {
    const breaker = new CircuitBreaker(2, 100); // Court timeout pour test

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Error'))
      .mockRejectedValueOnce(new Error('Error'))
      .mockResolvedValue('success');

    // Force l'ouverture
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();

    expect(breaker.getState()).toBe('open');

    // Attends le timeout
    await new Promise(resolve => setTimeout(resolve, 150));

    // Devrait passer en HALF-OPEN puis CLOSED après succès
    const result = await breaker.execute(fn);

    expect(result).toBe('success');
    expect(breaker.getState()).toBe('closed');
  });
});
