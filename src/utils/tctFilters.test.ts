import { expect,it } from 'vitest';
import { matchesTctId } from './tctFilters';
it('matches complete vehicle IDs rather than employee IDs or partial numbers',()=>{
 expect(matchesTctId('430','430')).toBe(true);expect(matchesTctId('430','43')).toBe(false);expect(matchesTctId('430','0536')).toBe(false);expect(matchesTctId('0430','430')).toBe(true);
});
it('accepts TCT IDs with optional prefix and leading zeros',()=>{
 expect(matchesTctId('TCT0033','33',true)).toBe(true);expect(matchesTctId('TCT0033','TCT0033',true)).toBe(true);expect(matchesTctId('TCT0033','3',true)).toBe(false);
});
it('supports multiple exact IDs',()=>{
 expect(matchesTctId('128','430+128')).toBe(true);expect(matchesTctId('128','430, 128')).toBe(true);expect(matchesTctId('128','430;128')).toBe(true);expect(matchesTctId('128','')).toBe(true);
});
