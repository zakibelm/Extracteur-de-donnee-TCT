import { ZodSchema } from 'zod';

/**
 * Validation Middleware
 * Validates request body against Zod schemas
 */
export function validateRequest<T>(schema: ZodSchema<T>, data: unknown): {
    success: boolean;
    data?: T;
    errors?: string[];
} {
    try {
        const validated = schema.parse(data);
        return { success: true, data: validated };
    } catch (error: any) {
        const errors = error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`) || ['Validation failed'];
        return { success: false, errors };
    }
}

/**
 * Sanitize string input (XSS prevention)
 */
export function sanitizeString(input: string): string {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Rate Limiter (Simple in-memory implementation)
 * For production, use Redis-based solution
 */
class RateLimiter {
    private requests: Map<string, number[]> = new Map();
    private readonly maxRequests: number;
    private readonly windowMs: number;

    constructor(maxRequests: number = 100, windowMs: number = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    check(identifier: string): { allowed: boolean; remaining: number } {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Get existing requests for this identifier
        let timestamps = this.requests.get(identifier) || [];

        // Filter out old requests
        timestamps = timestamps.filter(ts => ts > windowStart);

        // Check if limit exceeded
        if (timestamps.length >= this.maxRequests) {
            return { allowed: false, remaining: 0 };
        }

        // Add current request
        timestamps.push(now);
        this.requests.set(identifier, timestamps);

        return { allowed: true, remaining: this.maxRequests - timestamps.length };
    }

    reset(identifier: string): void {
        this.requests.delete(identifier);
    }
}

export const apiRateLimiter = new RateLimiter(100, 60000); // 100 requests per minute
export const extractionRateLimiter = new RateLimiter(20, 60000); // 20 extractions per minute
