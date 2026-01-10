import { pgTable, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    numDome: varchar('num_dome', { length: 50 }).primaryKey(),
    idEmploye: varchar('id_employe', { length: 50 }).notNull(),
    telephone: varchar('telephone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    isAdmin: boolean('is_admin').default(false),
    createdAt: timestamp('created_at').defaultNow(),
});
