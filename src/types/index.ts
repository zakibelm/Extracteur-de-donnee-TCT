export interface User {
    numDome: string;
    idEmploye: string;
    telephone?: string;
    isAdmin: boolean;
}

export interface ParsedContent {
    headers: string[];
    rows: string[][];
}

export interface ExtractedData {
    id: string;
    fileName: string;
    imageSrc: string;
    content: ParsedContent | null;
    status: Status;
}

export enum Status {
    Idle = 'idle',
    Processing = 'processing',
    AiProcessing = 'ai_processing',
    Success = 'success',
    Error = 'error'
}

export interface TableData {
    headers: string[];
    rows: string[][];
}
