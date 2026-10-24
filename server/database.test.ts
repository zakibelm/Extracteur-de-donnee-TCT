// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, expect, it } from 'vitest';

let db: PGlite;
const userId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const fields = ['tournee','nom','deb_tour','fin_tour','cl_veh','employe','nom_employe',
    'vehicule','cl_veh_aff','stationnement','approuve','territoire_debut','adresse_debut','adresse_fin'];
const row = Object.fromEntries(fields.map(key => [key, key]));

beforeAll(async () => {
    db = new PGlite();
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
        CREATE SCHEMA auth;
        CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB, raw_app_meta_data JSONB);
        CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS
        $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
        CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;`);
    await db.exec(readFileSync('supabase/bootstrap.sql', 'utf8'));
    await db.exec(`GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;`);
    await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;`);
    await db.exec(readFileSync('supabase/fix-admin-escalation.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/20261023_tct_source_14_columns.sql', 'utf8'));
    await db.query(`INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES ($1, 'test@example.test', '{"role":"admin"}')`, [userId]);
    await db.exec(`SET ROLE authenticated;`);
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId]);
    await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ app_metadata: { role: 'admin' } })]);
}, 30000);
afterAll(async () => { await db?.close(); });

const save = (id = requestId, rows = [row]) => db.query(
    `SELECT save_tct_extraction($1::uuid, 'document.pdf', now(), $2::jsonb) AS result`, [id, JSON.stringify(rows)]);

it('creates a driver profile even when signup metadata asks for admin', async () => {
    const result = await db.query<{ role: string; is_admin: boolean }>('SELECT role, is_admin FROM users WHERE id=$1', [userId]);
    expect(result.rows[0]).toEqual({ role: 'driver', is_admin: false });
});
it('saves the document, all 14 fields and audit history atomically without duplicate retries', async () => {
    const first = await save();
    const second = await save();
    expect(second.rows).toEqual(first.rows);
    const result = await db.query<{ documents: number; tournees: number; history: number }>(
        `SELECT (SELECT count(*)::int FROM tct_documents) documents,
        (SELECT count(*)::int FROM tct_tournees) tournees, (SELECT count(*)::int FROM tct_history) history`);
    expect(result.rows[0]).toEqual({ documents: 1, tournees: 1, history: 1 });
    const cells = await db.query('SELECT vehicule, adresse_fin FROM tct_tournees');
    expect(cells.rows[0]).toEqual({ vehicule: 'vehicule', adresse_fin: 'adresse_fin' });
});
it('rolls back the entire document if a tournee insert fails', async () => {
    await expect(save('33333333-3333-4333-8333-333333333333', [{ ...row, tournee: 'x'.repeat(101) }])).rejects.toThrow();
    const result = await db.query<{ count: number }>('SELECT count(*)::int FROM tct_documents');
    expect(result.rows[0].count).toBe(1);
});
it('rejects missing fields before writing', async () => {
    await expect(save('44444444-4444-4444-8444-444444444444', [{ tournee: 'only' }])).rejects.toThrow();
});
it('does not allow a user to promote their own profile', async () => {
    await expect(db.exec("UPDATE users SET role='admin', is_admin=true")).rejects.toThrow();
});
it('refuses a driver save and hides another user documents under RLS', async () => {
    await db.query(`SELECT set_config('request.jwt.claims', '{"app_metadata":{"role":"driver"}}', false)`);
    await expect(save()).rejects.toThrow('Administrator required');
    await db.query(`SELECT set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false)`);
    const result = await db.query('SELECT * FROM tct_documents');
    expect(result.rows).toEqual([]);
});

it('rejects TRUNCATE even for an authenticated administrator, preserving all documents', async () => {
    await db.query(`SELECT set_config('request.jwt.claims', '{"app_metadata":{"role":"admin"}}', false)`);
    await expect(db.exec('TRUNCATE public.users CASCADE')).rejects.toThrow(/permission denied/i);
    await expect(db.exec('TRUNCATE public.tct_documents CASCADE')).rejects.toThrow(/permission denied/i);
    await expect(db.exec('CREATE TRIGGER forged BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.protect_user_privileges()')).rejects.toThrow(/permission denied/i);
});
it('denies anonymous table access even when default grants originally allowed it', async () => {
    await db.exec('RESET ROLE; SET ROLE anon');
    await expect(db.exec('SELECT * FROM public.users')).rejects.toThrow(/permission denied/i);
    await expect(db.exec('TRUNCATE public.tct_documents CASCADE')).rejects.toThrow(/permission denied/i);
    await db.exec('RESET ROLE; SET ROLE authenticated');
});
it('retains a trusted admin and demotes a forged profile on repeated repair', async () => {
    await db.exec('RESET ROLE');
    await db.query(`UPDATE auth.users SET raw_app_meta_data='{"role":"admin"}' WHERE id=$1`, [userId]);
    await db.exec(readFileSync('supabase/fix-admin-escalation.sql', 'utf8'));
    let result = await db.query('SELECT role,is_admin FROM public.users');
    expect(result.rows).toEqual([{ role: 'admin', is_admin: true }]);
    await db.query(`UPDATE auth.users SET raw_app_meta_data='{}' WHERE id=$1`, [userId]);
    await db.exec(readFileSync('supabase/fix-admin-escalation.sql', 'utf8'));
    result = await db.query('SELECT role,is_admin FROM public.users');
    expect(result.rows).toEqual([{ role: 'driver', is_admin: false }]);
});
