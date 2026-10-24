export interface VisionModel {
    id: string;
    name: string;
    created: number;
    supportedParameters: string[];
    maxCompletionTokens: number;
}
// Deliberately small application shortlist: image input, structured tables,
// no reasoning-only, preview, free router or image-generation models.
export const EXTRACTION_MODELS = [
    { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini — recommandé' },
    { id: 'openai/gpt-4.1', name: 'GPT-4.1 — tableaux complexes' },
] as const;
export const DEFAULT_VISION_MODEL = EXTRACTION_MODELS[0].id;
export function isExtractionModel(id: string): boolean {
    return EXTRACTION_MODELS.some(model => model.id === id);
}
export function parseVisionModels(payload: unknown): VisionModel[] {
    const data = (payload as { data?: unknown })?.data;
    if (!Array.isArray(data)) throw new Error('Catalogue invalide.');
    return EXTRACTION_MODELS.flatMap(approved => {
        const model = data.find(m => m?.id === approved.id &&
            m.architecture?.input_modalities?.includes('image') &&
            m.architecture?.output_modalities?.includes('text') &&
            !m.architecture?.output_modalities?.includes('image') &&
            m.supported_parameters?.includes('structured_outputs') &&
            m.supported_parameters?.includes('response_format'));
        return model ? [{ id: approved.id, name: approved.name, created: Number(model.created) || 0,
            supportedParameters: model.supported_parameters,
            maxCompletionTokens: Number(model.top_provider?.max_completion_tokens) || 12000 }] : [];
    });
}
