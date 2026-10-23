export interface VisionModel {
    id: string;
    name: string;
    created: number;
    supportedParameters: string[];
    maxCompletionTokens: number;
}
export const DEFAULT_VISION_MODEL = 'openai/gpt-4o-mini';

// Do not offer text-only models or image generators for document extraction.
export function parseVisionModels(payload: unknown): VisionModel[] {
    const data = (payload as { data?: unknown })?.data;
    if (!Array.isArray(data)) throw new Error('Catalogue invalide.');
    const models = data.filter(m => typeof m?.id === 'string' && typeof m?.name === 'string' &&
        m.architecture?.input_modalities?.includes('image') &&
        m.architecture?.output_modalities?.includes('text') &&
        !m.architecture?.output_modalities?.includes('image'));
    return models.map(m => ({ id: m.id, name: m.name, created: Number(m.created) || 0,
        supportedParameters: Array.isArray(m.supported_parameters) ? m.supported_parameters : [],
        maxCompletionTokens: Number(m.top_provider?.max_completion_tokens) || 12000,
    })).sort((a, b) => b.created - a.created || a.name.localeCompare(b.name));
}
