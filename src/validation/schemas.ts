import { z } from 'zod';

/**
 * Validation Schemas using Zod
 * Provides runtime type checking and validation for API requests
 */

// User Schema
export const userSchema = z.object({
    numDome: z.string().min(1, "Numéro de domaine requis").max(50),
    idEmploye: z.string().min(1, "ID employé requis").max(50),
    telephone: z.string().optional(),
    isAdmin: z.boolean().default(false)
});

// Extraction Request Schema
export const extractionRequestSchema = z.object({
    prompt: z.string().min(1, "Prompt requis"),
    image: z.string().min(1, "Image requise (base64)"),
    mimeType: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/, "Type MIME invalide"),
    systemInstruction: z.string().optional(),
    temperature: z.number().min(0).max(2).default(0.1),
    schema: z.any().optional(),
    responseMimeType: z.string().optional()
});

// Extraction Save Schema
export const saveExtractionSchema = z.object({
    userId: z.string().min(1, "User ID requis"),
    section: z.enum(['tct', 'olymel'], { errorMap: () => ({ message: "Section invalide" }) }),
    fileName: z.string().min(1, "Nom de fichier requis"),
    status: z.enum(['idle', 'processing', 'ai_processing', 'success', 'error']),
    content: z.object({
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string()))
    }).nullable()
});

// Settings Schema
export const settingsSchema = z.object({
    openRouterApiKey: z.string().optional(),
    aiModel: z.string().optional(),
    systemPromptTct: z.string().optional(),
    systemPromptOlymel: z.string().optional(),
    enableRag: z.boolean().optional()
});

// API Key Header Schema
export const apiKeySchema = z.string().min(10, "API key trop courte");

// Export types
export type UserInput = z.infer<typeof userSchema>;
export type ExtractionRequest = z.infer<typeof extractionRequestSchema>;
export type SaveExtractionInput = z.infer<typeof saveExtractionSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
