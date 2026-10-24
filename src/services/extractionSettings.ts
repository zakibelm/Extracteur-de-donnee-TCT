import { DEFAULT_VISION_MODEL, isExtractionModel } from '../utils/visionModels';
// Secrets remain in memory for this tab; they are cleared on logout.
let apiKey = '';
export function setExtractionKey(value: string) { apiKey = value.trim(); }
export function getExtractionKey() { return apiKey; }

export function getExtractionModel() {
    const stored = localStorage.getItem('adt_settings_model');
    if (stored && isExtractionModel(stored)) return stored;
    localStorage.setItem('adt_settings_model', DEFAULT_VISION_MODEL);
    return DEFAULT_VISION_MODEL;
}
