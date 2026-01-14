import { pgTable, varchar, boolean, timestamp, serial, text, jsonb, index } from 'drizzle-orm/pg-core';

// ========================================
// TABLE USERS
// ========================================
export const users = pgTable('users', {
    numDome: varchar('num_dome', { length: 50 }).primaryKey(),
    idEmploye: varchar('id_employe', { length: 50 }).notNull().unique(),
    telephone: varchar('telephone', { length: 20 }),
    email: varchar('email', { length: 255 }).unique(),
    isAdmin: boolean('is_admin').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastLoginAt: timestamp('last_login_at'),
}, (table) => ({
    // Index sur idEmploye pour recherches rapides
    idEmployeIdx: index('idx_users_id_employe').on(table.idEmploye),
    // Index sur email pour recherches rapides
    emailIdx: index('idx_users_email').on(table.email),
}));

// ========================================
// TABLE EXTRACTIONS
// ========================================
export const extractions = pgTable('extractions', {
    id: serial('id').primaryKey(),

    // Relations
    userId: varchar('user_id', { length: 50 })
        .notNull()
        .references(() => users.numDome, { onDelete: 'cascade' }),

    // Métadonnées fichier
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileType: varchar('file_type', { length: 50 }).notNull(), // image/png, application/pdf, etc.
    fileSize: serial('file_size'), // Taille en octets

    // Données extraites (stockées en JSON pour flexibilité)
    extractedData: jsonb('extracted_data').notNull(),

    // Statut de l'extraction
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, processing, success, error
    errorMessage: text('error_message'),

    // Modèle IA utilisé
    aiModel: varchar('ai_model', { length: 100 }),

    // Métadonnées temporelles
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
}, (table) => ({
    // Index sur userId pour récupérer les extractions d'un utilisateur
    userIdIdx: index('idx_extractions_user_id').on(table.userId),
    // Index sur status pour filtrer par statut
    statusIdx: index('idx_extractions_status').on(table.status),
    // Index sur createdAt pour trier par date
    createdAtIdx: index('idx_extractions_created_at').on(table.createdAt),
    // Index composé pour requêtes fréquentes
    userStatusIdx: index('idx_extractions_user_status').on(table.userId, table.status),
}));

// ========================================
// TABLE AUDIT_LOGS (optionnel, pour traçabilité)
// ========================================
export const auditLogs = pgTable('audit_logs', {
    id: serial('id').primaryKey(),

    // Qui a fait l'action
    userId: varchar('user_id', { length: 50 })
        .references(() => users.numDome, { onDelete: 'set null' }),

    // Type d'action
    action: varchar('action', { length: 50 }).notNull(), // login, extraction, export, etc.

    // Détails de l'action (JSON)
    details: jsonb('details'),

    // Métadonnées
    ipAddress: varchar('ip_address', { length: 45 }), // Support IPv6
    userAgent: text('user_agent'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    // Index sur userId pour historique utilisateur
    userIdIdx: index('idx_audit_logs_user_id').on(table.userId),
    // Index sur action pour filtrer par type
    actionIdx: index('idx_audit_logs_action').on(table.action),
    // Index sur createdAt pour requêtes temporelles
    createdAtIdx: index('idx_audit_logs_created_at').on(table.createdAt),
}));
