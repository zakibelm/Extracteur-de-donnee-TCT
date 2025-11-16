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
// FIX: Add ChatMessage interface to resolve import error in ChatInterface.tsx.
export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

// FIX: Add AGENT_ROLES constant to resolve import error in ChatInterface.tsx.
export const AGENT_ROLES = [
    { id: 'auto', name: 'Auto', description: "L'IA choisit le meilleur rôle pour la tâche." },
    { id: 'analyst', name: 'Analyste', description: "Analyse les données, trouve des tendances et des insights." },
    { id: 'summarizer', name: 'Synthétiseur', description: "Résume les informations clés des données." },
    { id: 'planner', name: 'Planificateur', description: "Aide à planifier les tournées ou les logistiques." }
];
