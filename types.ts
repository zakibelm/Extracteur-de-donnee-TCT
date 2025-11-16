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

// FIX: Add ChatMessage interface and AGENT_ROLES constant for chat component.
export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export const AGENT_ROLES = [
    {
        id: 'auto',
        name: 'Automatique',
        description: "L'IA choisit le meilleur rôle pour répondre à la question."
    },
    {
        id: 'analyst',
        name: 'Analyste',
        description: "Adopte une perspective analytique pour trouver des tendances et des informations."
    },
    {
        id: 'summarizer',
        name: 'Synthétiseur',
        description: "Fournit des résumés concis et clairs des données."
    },
    {
        id: 'planner',
        name: 'Planificateur',
        description: "Aide à organiser les tâches ou à planifier la logistique en fonction des données."
    }
];
