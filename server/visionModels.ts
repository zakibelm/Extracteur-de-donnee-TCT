import { parseVisionModels, type VisionModel } from '../src/utils/visionModels.js';
import { HttpError } from './auth.js';
let cache: { models: VisionModel[]; expires: number } | undefined;
export async function getVisionModels(): Promise<VisionModel[]> {
    if (cache && cache.expires > Date.now()) return cache.models;
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Catalogue indisponible');
        const models = parseVisionModels(await response.json());
        if (!models.length) throw new Error('Catalogue vide');
        cache = { models, expires: Date.now() + 300000 };
        return models;
    } catch {
        throw new HttpError(503, 'Catalogue OpenRouter indisponible. Réessayez dans un instant.');
    }
}
export async function requireVisionModel(id: string) {
    const model = (await getVisionModels()).find(m => m.id === id);
    if (!model) throw new HttpError(400, 'Ce modèle est indisponible ou incompatible avec les images. Actualisez la liste dans Paramètres et choisissez un modèle vision.');
    return model;
}
