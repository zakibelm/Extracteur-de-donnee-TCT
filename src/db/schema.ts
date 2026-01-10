import { pgTable, varchar, boolean, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    numDome: varchar('num_dome', { length: 50 }).primaryKey(),
    idEmploye: varchar('id_employe', { length: 50 }).notNull(),
    telephone: varchar('telephone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    isAdmin: boolean('is_admin').default(false),
    createdAt: timestamp('created_at').defaultNow(),
});

export const extractions = pgTable('extractions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userDome: varchar('user_dome', { length: 50 }).references(() => users.numDome),
    section: varchar('section', { length: 20 }).notNull(),
    fileName: varchar('file_name', { length: 255 }),
    status: varchar('status', { length: 20 }),
    content: jsonb('content'),
    createdAt: timestamp('created_at').defaultNow(),
});
