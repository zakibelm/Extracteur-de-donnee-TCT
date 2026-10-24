import { TCT_ALL_FIELDS } from '../src/utils/table.js';
export function extractionResponseFormat(section: string, test = false) {
    const fields = [section === 'tct' ? 'schedule_code' : 'schedule_date', 'tournees_attribuees', 'tournees_simultanees', 'heure_de_pointe', 'tournees_en_retard'];
    const metadata = { type: 'object', properties: Object.fromEntries(fields.map(field => [field, {
        type: [field.startsWith('schedule_') || field === 'heure_de_pointe' ? 'string' : 'number','null'],
    }])), required: fields, additionalProperties: false };
    const schema = test ? {
        type:'object', properties:{ok:{type:'boolean'}}, required:['ok'], additionalProperties:false,
    } : section === 'tct' ? {
        type:'object', properties:{
            source_layout:{type:'string',enum:['dispatch_14','dispatch_16']},
            rows:{type:'array',items:{type:'object',properties:Object.fromEntries(TCT_ALL_FIELDS.map(field => [field,{type:'string'}])),required:[...TCT_ALL_FIELDS],additionalProperties:false}},
            metadata,
        },required:['source_layout','rows','metadata'],additionalProperties:false,
    } : {
        type:'object',properties:{
            headers:{type:'array',items:{type:'string'},minItems:5,maxItems:5},
            rows:{type:'array',items:{type:'array',items:{type:'string'},minItems:5,maxItems:5}},metadata,
        },required:['headers','rows','metadata'],additionalProperties:false,
    };
    return {type:'json_schema',json_schema:{name:test?'vision_test':'document_table',strict:true,schema}};
}
