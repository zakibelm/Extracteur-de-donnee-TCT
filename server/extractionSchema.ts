import { TCT_HEADERS } from '../src/utils/table.js';
export function extractionResponseFormat(section: string, test = false) {
    const fields = ['schedule_date', 'tournees_attribuees', 'tournees_simultanees', 'heure_de_pointe', 'tournees_en_retard'];
    const schema = test ? {
        type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false,
    } : {
        type: 'object',
        properties: {
            headers: { type: 'array', items: { type: 'string' }, minItems: section === 'tct' ? TCT_HEADERS.length : 5, maxItems: section === 'tct' ? TCT_HEADERS.length : 5 },
            rows: { type: 'array', items: { type: 'array', items: { type: 'string' }, minItems: section === 'tct' ? TCT_HEADERS.length : 5, maxItems: section === 'tct' ? TCT_HEADERS.length : 5 } },
            metadata: { type: 'object', properties: Object.fromEntries(fields.map(field => [field, {
                type: [field === 'schedule_date' || field === 'heure_de_pointe' ? 'string' : 'number', 'null'],
            }])), required: fields, additionalProperties: false },
        },
        required: ['headers', 'rows', 'metadata'], additionalProperties: false,
    };
    return { type: 'json_schema', json_schema: { name: test ? 'vision_test' : 'document_table', strict: true, schema } };
}
