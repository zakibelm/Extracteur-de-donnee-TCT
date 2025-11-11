export enum Status {
    Idle = 'idle',
    Processing = 'processing',
    OcrProcessing = 'ocr_processing',
    AiProcessing = 'ai_processing',
    Success = 'success',
    Error = 'error',
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export type ParsedContent = TableData;

export interface ExtractedData {
    id: string;
    fileName: string;
    imageSrc: string;
    content: ParsedContent | null;
    status: Status;
    taskId?: string;
}

export interface SummaryData {
    totalRows: number;
    uniqueChauffeurs: string[];
    uniqueVehicules: string[];
    uniqueAdressesDepart: string[];
    uniqueAdressesArrivee: string[];
}