// Secrets remain in memory for this tab; they are cleared on logout.
let apiKey = '';
export function setExtractionKey(value: string) { apiKey = value.trim(); }
export function getExtractionKey() { return apiKey; }

export function getExtractionModel() {
    const stored = localStorage.getItem('adt_settings_model');
    return !stored || ['google/gemini-2.0-flash-exp:free', 'google/gemini-pro-1.5', 'anthropic/claude-3.5-sonnet', 'mistral/mistral-large'].includes(stored)
        ? 'openai/gpt-4o-mini' : stored;
}
