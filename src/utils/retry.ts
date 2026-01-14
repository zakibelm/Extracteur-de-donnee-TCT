/**
 * Utilitaire de retry avec exponential backoff
 * Pour les appels API et opérations qui peuvent échouer temporairement
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 seconde
  maxDelay: 10000, // 10 secondes
  backoffMultiplier: 2,
  shouldRetry: (error: any) => {
    // Par défaut, retry sur les erreurs réseau et 5xx
    if (error?.name === 'NetworkError') return true;
    if (error?.response?.status >= 500) return true;
    if (error?.code === 'ECONNREFUSED') return true;
    return false;
  },
  onRetry: () => {},
};

/**
 * Calcule le délai avec exponential backoff et jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number {
  const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Ajoute un jitter aléatoire pour éviter les tempêtes de retry
  const jitter = Math.random() * 0.3 * cappedDelay; // +/- 30%

  return cappedDelay + jitter;
}

/**
 * Attend un certain délai (promesse)
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exécute une fonction avec retry automatique
 *
 * @example
 * ```ts
 * const data = await retryWithBackoff(
 *   () => fetch('/api/data').then(r => r.json()),
 *   { maxAttempts: 5 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      // Tente d'exécuter la fonction
      const result = await fn();

      // Succès! Retourne le résultat
      if (attempt > 1) {
        console.log(`✅ Retry successful après ${attempt} tentatives`);
      }
      return result;

    } catch (error) {
      lastError = error;

      // Vérifie si on doit retry
      const shouldRetry = opts.shouldRetry(error);
      const isLastAttempt = attempt === opts.maxAttempts;

      if (!shouldRetry || isLastAttempt) {
        // Ne pas retry ou dernière tentative échouée
        console.error(`❌ Échec définitif après ${attempt} tentative(s):`, error);
        throw error;
      }

      // Calcule le délai avant le prochain retry
      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.backoffMultiplier
      );

      console.warn(
        `⚠️ Tentative ${attempt}/${opts.maxAttempts} échouée. ` +
        `Retry dans ${Math.round(delay)}ms...`,
        error
      );

      // Callback avant retry
      opts.onRetry(attempt, error);

      // Attend avant le prochain retry
      await sleep(delay);
    }
  }

  // Ne devrait jamais arriver ici, mais par sécurité
  throw lastError;
}

/**
 * Variante spécialisée pour les appels fetch
 *
 * @example
 * ```ts
 * const response = await retryFetch('https://api.example.com/data', {
 *   headers: { 'Authorization': 'Bearer token' }
 * }, {
 *   maxAttempts: 5
 * });
 * ```
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(url, init);

      // Traite les erreurs HTTP comme des erreurs
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as any;
        error.response = response;
        error.status = response.status;
        throw error;
      }

      return response;
    },
    {
      ...options,
      shouldRetry: (error: any) => {
        // Retry sur erreurs réseau
        if (error?.name === 'TypeError' && error?.message?.includes('fetch')) {
          return true;
        }

        // Retry sur 5xx et 429 (rate limit)
        const status = error?.status || error?.response?.status;
        if (status >= 500 || status === 429) {
          return true;
        }

        // Utilise le shouldRetry personnalisé si fourni
        if (options?.shouldRetry) {
          return options.shouldRetry(error);
        }

        return false;
      },
    }
  );
}

/**
 * Wrapper pour retryFetch avec parsing JSON automatique
 *
 * @example
 * ```ts
 * const data = await retryFetchJSON<{ id: number }>('https://api.example.com/data');
 * ```
 */
export async function retryFetchJSON<T = any>(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<T> {
  const response = await retryFetch(url, init, options);
  return response.json();
}

/**
 * Circuit Breaker Pattern - Empêche les appels répétés à un service défaillant
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // État OPEN - le circuit est ouvert, refuse les requêtes
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;

      if (timeSinceLastFailure < this.resetTimeout) {
        throw new Error(
          `Circuit breaker is OPEN. Service unavailable. ` +
          `Retry in ${Math.round((this.resetTimeout - timeSinceLastFailure) / 1000)}s`
        );
      }

      // Tente de passer en HALF-OPEN
      this.state = 'half-open';
      console.log('🔄 Circuit breaker: OPEN -> HALF-OPEN (tentative de récupération)');
    }

    try {
      const result = await fn();

      // Succès - réinitialise le compteur
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failureCount = 0;
        console.log('✅ Circuit breaker: HALF-OPEN -> CLOSED (service récupéré)');
      } else if (this.failureCount > 0) {
        this.failureCount = 0;
      }

      return result;

    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      // Si on dépasse le seuil, ouvre le circuit
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'open';
        console.error(
          `🔴 Circuit breaker: ${this.state === 'half-open' ? 'HALF-OPEN' : 'CLOSED'} -> OPEN ` +
          `(${this.failureCount} échecs)`
        );
      }

      throw error;
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.state = 'closed';
    console.log('🔄 Circuit breaker: Reset manuel');
  }
}
