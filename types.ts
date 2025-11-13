export enum Status {
    Idle = 'idle',
    Processing = 'processing',
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
}

export interface SummaryData {
    totalRows: number;
    uniqueChauffeurs: string[];
    uniqueVehicules: string[];
    uniqueAdressesDepart: string[];
    uniqueAdressesArrivee: string[];
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}
