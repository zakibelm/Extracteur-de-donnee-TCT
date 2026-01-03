import { pgTable, serial, text, boolean, timestamp, jsonb, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    numDome: text('num_dome').notNull().unique(),
    idEmploye: text('id_employe').notNull(),
    telephone: text('telephone'),
    isAdmin: boolean('is_admin').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
});

export const extractions = pgTable('extractions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_dome').notNull(), // Linking by NumDome for simplicity or we could use user ID
    section: text('section').notNull(), // 'tct' | 'olymel'
    fileName: text('file_name').notNull(),
    status: text('status').notNull(), // 'success' | 'error' | 'processing'
    content: jsonb('content'), // Stores the Analyzed Data JSON
    createdAt: timestamp('created_at').defaultNow().notNull()
});
