import { DEFAULT_VISION_MODEL, isExtractionModel } from '../utils/visionModels';
// Typing activates a key in memory. Only an explicit Save writes it on this device.
let apiKey = '';
let ownerId: string | null = null;
const keyFor = (id: string) => 'adt_openrouter_key_v1:' + id;
export function bindExtractionOwner(id: string | null) {
    if (id === ownerId) { if (!id) apiKey = ''; return; }
    ownerId = id;
    apiKey = '';
    if (id) {
        try { apiKey = localStorage.getItem(keyFor(id)) || ''; }
        catch { /* Storage may be unavailable; an in-memory key still works. */ }
    }
}
export function setExtractionKey(value: string) { apiKey = value.trim(); }
export function getExtractionKey() { return apiKey; }
export function persistExtractionKey() {
    if (!ownerId) throw new Error('Connectez-vous avant de mémoriser une clé.');
    try {
        const name = keyFor(ownerId);
        if (apiKey) localStorage.setItem(name, apiKey);
        else localStorage.removeItem(name);
        if ((localStorage.getItem(name) || '') !== apiKey) throw new Error('Storage verification failed');
    } catch {
        throw new Error('Le navigateur refuse la mémorisation. La clé fonctionne seulement dans cet onglet ; vérifiez les autorisations de stockage.');
    }
}
export function hasSavedExtractionKey() {
    if (!ownerId || !apiKey) return false;
    try { return localStorage.getItem(keyFor(ownerId)) === apiKey; }
    catch { return false; }
}
export function forgetExtractionKey() {
    if (ownerId) {
        try { localStorage.removeItem(keyFor(ownerId)); }
        catch { throw new Error('Impossible de supprimer la clé mémorisée. Vérifiez les autorisations de stockage du navigateur.'); }
    }
    apiKey = '';
}
export function getExtractionModel() {
    const stored = localStorage.getItem('adt_settings_model');
    if (stored && isExtractionModel(stored)) return stored;
    localStorage.setItem('adt_settings_model', DEFAULT_VISION_MODEL);
    return DEFAULT_VISION_MODEL;
}
