/**
 * Schémas de validation Zod pour l'application ADT
 * Sécurise toutes les entrées utilisateur et API
 */

import { z } from 'zod';

// ========================================
// VALIDATION UTILISATEUR
// ========================================

export const UserSchema = z.object({
  numDome: z.string()
    .min(1, "Le numéro Dôme est requis")
    .max(50, "Le numéro Dôme ne peut pas dépasser 50 caractères")
    .regex(/^[a-zA-Z0-9-_]+$/, "Le numéro Dôme ne peut contenir que des lettres, chiffres, tirets et underscores"),

  idEmploye: z.string()
    .min(1, "L'ID employé est requis")
    .max(50, "L'ID employé ne peut pas dépasser 50 caractères")
    .regex(/^[a-zA-Z0-9-_]+$/, "L'ID employé ne peut contenir que des lettres, chiffres, tirets et underscores"),

  telephone: z.string()
    .regex(/^[\d\s\-\+\(\)]*$/, "Numéro de téléphone invalide")
    .max(20, "Le téléphone ne peut pas dépasser 20 caractères")
    .optional()
    .or(z.literal('')),

  email: z.string()
    .email("Email invalide")
    .max(255, "L'email ne peut pas dépasser 255 caractères")
    .optional()
    .or(z.literal('')),

  isAdmin: z.boolean()
    .default(false),

  createdAt: z.date()
    .or(z.string().datetime())
    .optional(),
});

export type ValidatedUser = z.infer<typeof UserSchema>;

// ========================================
// VALIDATION EXTRACTION
// ========================================

export const ExtractionRowSchema = z.object({
  tournee: z.string().optional(),
  nom_compagnie: z.string().optional(),
  debut_tournee: z.string().optional(),
  fin_tournee: z.string().optional(),
  classe_vehicule: z.string().optional(),
  id_employe: z.string().optional(),
  nom_employe_complet: z.string().optional(),
  id_employe_confirm: z.string().optional(),
  vehicule: z.string().optional(),
  classe_vehicule_affecte: z.string().optional(),
  autorisation: z.string().optional(),
  approuve: z.string().optional(),
  retour: z.string().optional(),
  adresse_debut: z.string().optional(),
  adresse_fin: z.string().optional(),
});

export const ExtractionDataSchema = z.object({
  id: z.string(),
  userId: z.string(),
  fileName: z.string()
    .max(255, "Nom de fichier trop long"),

  fileType: z.enum(['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']),

  extractedData: z.object({
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),

  validatedRows: z.array(ExtractionRowSchema).optional(),

  status: z.enum(['idle', 'processing', 'success', 'error']),

  errorMessage: z.string().optional(),

  createdAt: z.date()
    .or(z.string().datetime())
    .optional(),

  updatedAt: z.date()
    .or(z.string().datetime())
    .optional(),
});

export type ValidatedExtraction = z.infer<typeof ExtractionDataSchema>;

// ========================================
// VALIDATION PARAMÈTRES IA
// ========================================

export const AISettingsSchema = z.object({
  openRouterKey: z.string()
    .min(10, "Clé API OpenRouter invalide")
    .regex(/^sk-or-v1-/, "La clé doit commencer par 'sk-or-v1-'"),

  modelId: z.string()
    .min(1, "Modèle IA requis"),

  temperature: z.number()
    .min(0, "La température doit être >= 0")
    .max(2, "La température doit être <= 2")
    .optional()
    .default(0.1),

  maxTokens: z.number()
    .min(100, "Les tokens maximum doivent être >= 100")
    .max(10000, "Les tokens maximum doivent être <= 10000")
    .optional()
    .default(4000),
});

export type ValidatedAISettings = z.infer<typeof AISettingsSchema>;

// ========================================
// VALIDATION FICHIER UPLOAD
// ========================================

export const FileUploadSchema = z.object({
  file: z.instanceof(File),

  name: z.string()
    .max(255, "Nom de fichier trop long"),

  size: z.number()
    .max(50 * 1024 * 1024, "Le fichier ne peut pas dépasser 50MB"),

  type: z.enum(['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'])
    .or(z.string().regex(/^image\/(png|jpeg|jpg)$|^application\/pdf$/)),
});

// ========================================
// VALIDATION VARIABLES D'ENVIRONNEMENT
// ========================================

export const EnvSchema = z.object({
  DATABASE_URL: z.string()
    .url("DATABASE_URL doit être une URL valide")
    .regex(/^postgresql:\/\//, "DATABASE_URL doit être une URL PostgreSQL"),

  OPENROUTER_API_KEY: z.string()
    .min(10, "OPENROUTER_API_KEY est requis")
    .optional(),

  NODE_ENV: z.enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.string()
    .regex(/^\d+$/, "PORT doit être un nombre")
    .transform(Number)
    .pipe(z.number().min(1).max(65535))
    .default('3002')
    .transform(String),

  ALLOWED_ORIGINS: z.string()
    .transform(val => val.split(',').map(s => s.trim()))
    .default('http://localhost:3005'),

  SESSION_SECRET: z.string()
    .min(32, "SESSION_SECRET doit faire au moins 32 caractères pour être sécurisé")
    .optional(),

  SENTRY_DSN: z.string()
    .url("SENTRY_DSN doit être une URL valide")
    .optional()
    .or(z.literal('')),

  ENABLE_MOCK_MODE: z.string()
    .transform(val => val === 'true')
    .default('false'),

  ENABLE_DEBUG_LOGS: z.string()
    .transform(val => val === 'true')
    .default('true'),
});

export type ValidatedEnv = z.infer<typeof EnvSchema>;

// ========================================
// HELPERS DE VALIDATION
// ========================================

/**
 * Valide des données avec un schéma Zod et retourne le résultat
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

/**
 * Valide des données avec un schéma Zod et lance une erreur si invalide
 */
export function validateOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage?: string
): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    // Compatible avec Zod v4
    const errorDetails = result.error?.errors
      ? result.error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
      : String(result.error);

    throw new Error(errorMessage || `Validation failed: ${errorDetails}`);
  }

  return result.data;
}

/**
 * Nettoie et sanitise une chaîne pour éviter les injections
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Supprime < et > pour éviter XSS
    .trim();
}
