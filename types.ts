
export interface User {
  numDome: string;
  idEmploye: string;
  telephone?: string;
  email?: string;
  isAdmin: boolean;
  createdAt?: string;
}

export interface AISettings {
  openRouterKey: string;
  modelId: string;
  systemPrompt: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface SheetRow {
  timestamp: string;
  user_email: string;
  image_id: string;
  extracted_data: {
    headers: string[];
    rows: string[][];
  };
  status: string;
  notes: string;
}

export const TABLE_HEADERS = [
  "Tournée", "Nom", "Déb tour", "Fin tour", "Cl véh",
  "Employé", "Nom de l'employé", "Employé (Confirm)",
  "Véhicule", "Changement", "Changement par", "Cl véh aff",
  "Autoris", "Approuvé", "Retour",
  "Adresse de début", "Adresse de fin"
];

export const AGENT_ROLES = [
  { id: 'auto', name: 'Auto', description: 'Sélection automatique' },
  { id: 'dispatch', name: 'Répartiteur', description: 'Expert logistique' },
  { id: 'analyst', name: 'Analyste', description: 'Expert données' },
  { id: 'support', name: 'Support', description: 'Support technique' }
];

export enum Status {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error',
  AiProcessing = 'ai_processing',
  Processing = 'processing'
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface ParsedContent extends TableData { }

export interface ExtractedData {
  id: string;
  fileName: string;
  imageSrc: string;
  content: TableData | null;
  status: Status;
  timestamp: number;
}

export const DEFAULT_SETTINGS: AISettings = {
  openRouterKey: '',
  modelId: 'gemini-3-flash-preview',
  systemPrompt: `Extraire le tableau "Affectations des tournées" sous forme de JSON pur. 
Chaque ligne du tableau doit correspondre aux colonnes suivantes : ${TABLE_HEADERS.slice(0, -2).join(', ')}.
Si une information est manquante, laissez une chaîne vide.`
};
