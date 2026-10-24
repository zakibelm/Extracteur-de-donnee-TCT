import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/supabaseClient', () => ({ supabase: { auth: { getUser: vi.fn() }, rpc: vi.fn(), from: vi.fn() } }));
import { supabase } from '../lib/supabaseClient';
import { getSavedExtraction, saveExtractionToSupabase } from './supabaseService';
import { TCT_FIELDS } from '../utils/table';
const payload = { document: { filename: 'scan.jpg', upload_date: '2026-10-24T12:00:00Z', status: 'success' as const, user_id: 'owner', extracted_count: 1 },
    tournees: [Object.fromEntries(TCT_FIELDS.map(field => [field, '0458']))] as never, user_id: 'owner', request_id: 'request-id' };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'owner' } }, error: null } as never); });
it('only confirms a save when the database acknowledges the complete row count', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true, documentId: 42, tourneesCount: 1 }, error: null } as never);
    await expect(saveExtractionToSupabase(payload)).resolves.toMatchObject({ documentId: 42 });
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true, documentId: 42, tourneesCount: 0 }, error: null } as never);
    await expect(saveExtractionToSupabase(payload)).rejects.toThrow('confirmé');
});
it('never silently treats a database failure or a mismatched identity as a saved result', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'failure' } } as never);
    await expect(saveExtractionToSupabase(payload)).rejects.toThrow('Sauvegarde impossible');
    await expect(saveExtractionToSupabase({ ...payload, user_id: 'another' })).rejects.toThrow('Identité');
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
it('reloads the saved table with its date, source order and leading zeros', async () => {
    const document = { filename: 'scan.jpg', extracted_count: 1, source_metadata: { schedule_date: '2026-10-24' } };
    const docQuery = { eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: document, error: null }) };
    const rowQuery = { eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [Object.fromEntries(TCT_FIELDS.map(field => [field, '0458']))], error: null }) };
    vi.mocked(supabase.from).mockImplementation((table: string) => ({ select: () => table === 'tct_documents' ? docQuery : rowQuery }) as never);
    const saved = await getSavedExtraction('owner', 42);
    expect(docQuery.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(saved.table.rows[0]).toHaveLength(14);
    expect(saved.table.rows[0][5]).toBe('0458');
    expect(saved.table.metadata?.schedule_date).toBe('2026-10-24');
    expect(rowQuery.order).toHaveBeenCalledWith('id', { ascending: true });
});

it('reloads more than the default 1000-row API page without silently truncating a document', async () => {
    const document = { filename: 'large.pdf', extracted_count: 1001, source_metadata: {} };
    const row = Object.fromEntries(TCT_FIELDS.map(field => [field, '']));
    const docQuery = { eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: document, error: null }) };
    const rowQuery = { eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn()
        .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => row), error: null })
        .mockResolvedValueOnce({ data: [row], error: null }) };
    vi.mocked(supabase.from).mockImplementation((table: string) => ({ select: () => table === 'tct_documents' ? docQuery : rowQuery }) as never);
    expect((await getSavedExtraction('owner', 42)).table.rows).toHaveLength(1001);
});

it('reloads all 16 source columns instead of the old projection',async()=>{
 const document={filename:'source16.jpg',extracted_count:1,source_metadata:{source_layout:'dispatch_16',schedule_code:'20261018',schedule_date:'2026-10-18'}};
 const row={...Object.fromEntries(TCT_FIELDS.map(field=>[field,''])),employe:'0536',employe_affecte:'0536',vehicule:'430',cl_veh_aff:'TAXI',autoris:'',retour:'Non',statut_fdr:''};
 const docQuery={eq:vi.fn().mockReturnThis(),single:vi.fn().mockResolvedValue({data:document,error:null})};
 const rowQuery={eq:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),range:vi.fn().mockResolvedValue({data:[row],error:null})};
 vi.mocked(supabase.from).mockImplementation((table:string)=>({select:()=>table==='tct_documents'?docQuery:rowQuery}) as never);
 const saved=await getSavedExtraction('owner',42);
 expect(saved.table.headers).toHaveLength(16);expect(saved.table.rows[0][7]).toBe('0536');expect(saved.table.rows[0][8]).toBe('430');expect(saved.table.rows[0][9]).toBe('TAXI');
});
