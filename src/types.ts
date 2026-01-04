export enum Status {
  Idle = 'idle',
  Processing = 'processing',
  AiProcessing = 'ai_processing',
  Success = 'success',
  Error = 'error',
}

export interface User {
  numDome: string; // "123"
  idEmploye: string; // "EMP001"
  isAdmin: boolean;
  telephone?: string;
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

export const AGENT_ROLES = [
  { id: 'auto', name: '🤖 Auto', description: 'L\'IA choisit le meilleur rôle pour répondre à votre question.' },
  { id: 'ForecastAgent', name: '📈 Prévisions', description: 'Analyse les données pour générer des prévisions, identifier les tendances et fournir des projections.' },
  { id: 'AccountingAgent', name: '🧾 Comptabilité', description: 'Traite et synthétise les informations factuelles pour une vue d\'ensemble précise.' },
  { id: 'TaxAgent', name: '🛡️ Fiscalité & Conformité', description: 'Se concentre sur la conformité, les règles et les extractions de chiffres spécifiques.' },
  { id: 'AuditAgent', name: '🔍 Audit & Contrôles', description: 'Recherche les incohérences, les anomalies et les risques potentiels dans les données.' },
  { id: 'InvestmentAgent', name: '💡 Investissement', description: 'Évalue les données pour identifier les opportunités d\'optimisation et les risques.' },
  { id: 'CommsAgent', name: '🗣️ Communication', description: 'Génère des rapports clairs, des résumés et des communications basées sur les données.' },
  { id: 'DerivativePricingAgent', name: '📊 Analyse de Risque', description: 'Se spécialise dans l\'analyse de scénarios complexes et l\'évaluation des risques.' },
  { id: 'SupervisorAgent', name: '✅ Assurance Qualité', description: 'S\'assure de la qualité et de la conformité de la réponse, supervise la collaboration.' },
  { id: 'FinanceAgent', name: '♟️ Stratégie', description: 'Fournit une analyse stratégique de haut niveau et des recommandations.' },
];

export const AGENT_DETAILS: { [key: string]: { name: string; description: string } } = {
  'ForecastAgent': { name: 'ForecastAgent (Prévisions)', description: 'Analyse les données pour générer des prévisions, identifier les tendances et fournir des projections.' },
  'AccountingAgent': { name: 'AccountingAgent (Comptabilité)', description: 'Traite et synthétise les informations factuelles pour une vue d\'ensemble précise.' },
  'TaxAgent': { name: 'TaxAgent (Fiscalité & Conformité)', description: 'Se concentre sur la conformité, les règles et les extractions de chiffres spécifiques.' },
  'AuditAgent': { name: 'AuditAgent (Audit & Contrôles)', description: 'Recherche les incohérences, les anomalies et les risques potentiels dans les données.' },
  'InvestmentAgent': { name: 'InvestmentAgent (Investissement)', description: 'Évalue les données pour identifier les opportunités d\'optimisation et les risques.' },
  'CommsAgent': { name: 'CommsAgent (Communication)', description: 'Génère des rapports clairs, des résumés et des communications basées sur les données.' },
  'DerivativePricingAgent': { name: 'DerivativePricingAgent (Analyse de Risque)', description: 'Se spécialise dans l\'analyse de scénarios complexes et l\'évaluation des risques.' },
  'SupervisorAgent': { name: 'SupervisorAgent (Assurance Qualité)', description: 'S\'assure de la qualité et de la conformité de la réponse, supervise la collaboration.' },
  'FinanceAgent': { name: 'FinanceAgent (Stratégie)', description: 'Fournit une analyse stratégique de haut niveau et des recommandations.' },
};