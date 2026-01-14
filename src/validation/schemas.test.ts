/**
 * Tests pour les schémas de validation Zod
 */

import { describe, it, expect } from 'vitest';
import {
  UserSchema,
  AISettingsSchema,
  FileUploadSchema,
  validateData,
  validateOrThrow,
  sanitizeString,
} from './schemas';

describe('UserSchema', () => {
  it('devrait valider un utilisateur valide', () => {
    const validUser = {
      numDome: '402',
      idEmploye: '919',
      telephone: '514-123-4567',
      email: 'user@example.com',
      isAdmin: false,
    };

    const result = validateData(UserSchema, validUser);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.numDome).toBe('402');
      expect(result.data.idEmploye).toBe('919');
    }
  });

  it('devrait rejeter un utilisateur avec numDome invalide', () => {
    const invalidUser = {
      numDome: '', // Vide
      idEmploye: '919',
      isAdmin: false,
    };

    const result = validateData(UserSchema, invalidUser);

    // Vérifie simplement que la validation a échoué
    expect(result.success).toBe(false);
  });

  it('devrait rejeter un numDome avec caractères spéciaux', () => {
    const invalidUser = {
      numDome: '402@#$',
      idEmploye: '919',
      isAdmin: false,
    };

    const result = validateData(UserSchema, invalidUser);

    expect(result.success).toBe(false);
  });

  it('devrait accepter un email valide', () => {
    const validUser = {
      numDome: '402',
      idEmploye: '919',
      email: 'test@example.com',
      isAdmin: false,
    };

    const result = validateData(UserSchema, validUser);

    expect(result.success).toBe(true);
  });

  it('devrait rejeter un email invalide', () => {
    const invalidUser = {
      numDome: '402',
      idEmploye: '919',
      email: 'not-an-email',
      isAdmin: false,
    };

    const result = validateData(UserSchema, invalidUser);

    expect(result.success).toBe(false);
  });
});

describe('AISettingsSchema', () => {
  it('devrait valider des paramètres IA valides', () => {
    const validSettings = {
      openRouterKey: 'sk-or-v1-abc123',
      modelId: 'openai/gpt-4o',
      temperature: 0.1,
      maxTokens: 4000,
    };

    const result = validateData(AISettingsSchema, validSettings);

    expect(result.success).toBe(true);
  });

  it('devrait rejeter une clé API invalide', () => {
    const invalidSettings = {
      openRouterKey: 'invalid-key', // Ne commence pas par sk-or-v1-
      modelId: 'openai/gpt-4o',
    };

    const result = validateData(AISettingsSchema, invalidSettings);

    expect(result.success).toBe(false);
  });

  it('devrait rejeter une température hors limites', () => {
    const invalidSettings = {
      openRouterKey: 'sk-or-v1-abc123',
      modelId: 'openai/gpt-4o',
      temperature: 5, // > 2
    };

    const result = validateData(AISettingsSchema, invalidSettings);

    expect(result.success).toBe(false);
  });

  it('devrait utiliser les valeurs par défaut', () => {
    const minimalSettings = {
      openRouterKey: 'sk-or-v1-abc123',
      modelId: 'openai/gpt-4o',
    };

    const result = validateData(AISettingsSchema, minimalSettings);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.temperature).toBe(0.1);
      expect(result.data.maxTokens).toBe(4000);
    }
  });
});

describe('validateOrThrow', () => {
  it('devrait retourner les données si valides', () => {
    const validData = {
      numDome: '402',
      idEmploye: '919',
      isAdmin: false,
    };

    const result = validateOrThrow(UserSchema, validData);

    expect(result.numDome).toBe('402');
  });

  it('devrait lancer une erreur si invalide', () => {
    const invalidData = {
      numDome: '',
      idEmploye: '919',
    };

    expect(() => {
      validateOrThrow(UserSchema, invalidData);
    }).toThrow('Validation failed');
  });

  it('devrait utiliser un message d\'erreur personnalisé', () => {
    const invalidData = {
      numDome: '',
      idEmploye: '919',
    };

    expect(() => {
      validateOrThrow(UserSchema, invalidData, 'Custom error message');
    }).toThrow('Custom error message');
  });
});

describe('sanitizeString', () => {
  it('devrait supprimer les balises HTML', () => {
    const input = '<script>alert("XSS")</script>';
    const result = sanitizeString(input);

    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('devrait trimmer les espaces', () => {
    const input = '  hello world  ';
    const result = sanitizeString(input);

    expect(result).toBe('hello world');
  });

  it('devrait gérer les chaînes vides', () => {
    const result = sanitizeString('');

    expect(result).toBe('');
  });
});
