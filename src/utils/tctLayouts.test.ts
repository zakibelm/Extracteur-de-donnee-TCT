import { expect, it } from 'vitest';
import { TCT_ALL_FIELDS,TCT_DISPATCH_HEADERS,normalizeTctExtraction,toTctRecords,buildUnifiedTable,validateTctTable } from './table';
import { Status } from '../types';
const source = {...Object.fromEntries(TCT_ALL_FIELDS.map(field=>[field,''])),tournee:'TCT0033',nom:'Transporteur…',deb_tour:'7:06',fin_tour:'8:03',cl_veh:'TAXI',employe:'0536',nom_employe:'Exemple',employe_affecte:'0536',vehicule:'430',cl_veh_aff:'TAXI',approuve:'Oui',retour:'Non',adresse_debut:'Adresse tronquée…'};
it('maps the 16-column source without putting employee IDs in the vehicle field',()=>{
 const table=normalizeTctExtraction({source_layout:'dispatch_16',rows:[source],metadata:{schedule_code:'20261018'}});
 expect(table.headers).toHaveLength(16);expect(table.headers).toEqual([...TCT_DISPATCH_HEADERS]);
 expect(table.rows[0][7]).toBe('0536');expect(table.rows[0][8]).toBe('430');expect(table.rows[0][9]).toBe('TAXI');expect(table.rows[0][3]).toBe('8:03');
 expect(table.metadata?.schedule_date).toBe('2026-10-18');
 expect(toTctRecords(table)[0]).toMatchObject({employe:'0536',employe_affecte:'0536',vehicule:'430',cl_veh_aff:'TAXI',autoris:'',retour:'Non',statut_fdr:'',stationnement:'',territoire_debut:''});
});
it('preserves layout metadata when the schedule is unreadable',()=>{
 const table=normalizeTctExtraction({source_layout:'dispatch_16',rows:[source],metadata:{}});
 expect(buildUnifiedTable([{id:'qa',fileName:'qa.jpg',imageSrc:'',status:Status.Success,content:table}])?.metadata?.source_layout).toBe('dispatch_16');
});
it('rejects a shifted numeric vehicle class',()=>{
 const table=normalizeTctExtraction({source_layout:'dispatch_16',rows:[source],metadata:{}});table.rows[0][9]='430';
 expect(()=>validateTctTable(table)).toThrow('Décalage');
});
it('rejects impossible raw schedule codes',()=>{
 expect(()=>normalizeTctExtraction({source_layout:'dispatch_16',rows:[source],metadata:{schedule_code:'20261318'}})).toThrow();
});
