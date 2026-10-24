import { expect, it } from 'vitest';
import { getExtractionModel } from './extractionSettings';
it('migrates every previously selected unsupported model to the application default', () => {
    for (const id of ['preview/vision', 'google/gemini-2.5-flash', 'openai/gpt-4o-mini']) {
        localStorage.setItem('adt_settings_model', id);
        expect(getExtractionModel()).toBe('openai/gpt-4.1-mini');
        expect(localStorage.getItem('adt_settings_model')).toBe('openai/gpt-4.1-mini');
    }
});
