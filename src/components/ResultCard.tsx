
import React from 'react';
import { ExtractedData, Status } from '../types';
import { Icons } from './Icons';

interface ResultCardProps {
  data: ExtractedData;
  onDelete: (id: string) => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ data, onDelete }) => {
  const { fileName, imageSrc, content, status } = data;

  const getStatusIndicator = () => {
    switch (status) {
      case Status.AiProcessing:
        return (
          <div className="flex items-center text-sky-400">
            <Icons.Sparkles className="w-4 h-4 mr-2 animate-pulse" />
            <span>IA...</span>
          </div>
        );
      case Status.Processing: // Fallback
        return (
          <div className="flex items-center text-sky-400">
            <Icons.Loader className="w-4 h-4 mr-2 animate-spin" />
            <span>Traitement...</span>
          </div>
        );
      case Status.Success:
        return (
          <div className="flex items-center text-emerald-400">
            <Icons.CheckCircle className="w-4 h-4 mr-2" />
            <span>Terminé</span>
          </div>
        );
      case Status.Error:
        return (
          <div className="flex items-center text-red-400">
            <Icons.XCircle className="w-4 h-4 mr-2" />
            <span>Erreur</span>
          </div>
        );
      default:
        return <span className="text-slate-500">En attente</span>;
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300 relative group">
      {/* Header Image & Controls */}
      <div className="relative h-40 bg-slate-900 overflow-hidden">
        <img
          src={imageSrc}
          alt={fileName}
          className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

        {/* Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(data.id);
          }}
          className="absolute top-2 right-2 p-2 bg-slate-900/80 hover:bg-red-600/90 text-slate-300 hover:text-white rounded-full transition-all duration-200 backdrop-blur-sm shadow-lg z-10"
          title="Supprimer ce fichier"
        >
          <Icons.Trash className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-slate-100 truncate max-w-[80%]" title={fileName}>
            {fileName}
          </h3>
        </div>

        <div className="mb-4 text-sm font-medium">
          {getStatusIndicator()}
        </div>

        {/* Stats/Preview */}
        {status === Status.Success && content && (
          <div className="mt-auto space-y-2 text-xs text-slate-400 bg-slate-900/50 p-3 rounded-md border border-slate-700/50">
            <div className="flex justify-between">
              <span>Lignes extraites:</span>
              <span className="font-mono text-emerald-400">{content.rows.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Colonnes:</span>
              <span className="font-mono text-sky-400">{content.headers.length}</span>
            </div>
          </div>
        )}

        {status === Status.Error && (
          <div className="mt-auto text-xs text-red-400 bg-red-900/10 p-2 rounded border border-red-900/20 break-words">
            {content?.rows?.[0]?.[0] || "Échec de l'analyse."}
          </div>
        )}
      </div>
    </div>
  );
};
