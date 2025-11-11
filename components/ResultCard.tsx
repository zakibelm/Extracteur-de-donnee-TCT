import React from 'react';
import { ExtractedData, Status } from '../types';
import { Icons } from './Icons';

interface ResultCardProps {
  data: ExtractedData;
}

export const ResultCard: React.FC<ResultCardProps> = ({ data }) => {
  const { fileName, imageSrc, content, status } = data;

  const getStatusIndicator = () => {
    switch (status) {
      case Status.OcrProcessing:
        return (
          <div className="flex items-center text-sky-400">
            <Icons.ScanText className="w-4 h-4 mr-2 animate-pulse" />
            <span>OCR...</span>
          </div>
        );
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
            <span>Succès</span>
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
        return null;
    }
  };

  const renderContent = () => {
    if (status === Status.OcrProcessing || status === Status.AiProcessing || status === Status.Processing) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-slate-500">
             {status === Status.OcrProcessing && "Scan des caractères..."}
             {status === Status.AiProcessing && "Analyse par l'IA..."}
             {status === Status.Processing && "Traitement en cours..."}
          </div>
        </div>
      );
    }
    if (!content) {
      return "Aucun contenu n'a été extrait.";
    }
    if (typeof content === 'string') {
       // Also check for empty string
      return content.trim() ? content : "Aucun contenu textuel trouvé.";
    }
    // It's a table
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-800">
            <tr className="text-slate-300">
              {content.headers.map((header, index) => (
                <th key={index} className="p-1.5 font-semibold border-b border-slate-600">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-slate-700 even:bg-slate-800/50 hover:bg-slate-700/50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="p-1.5 text-slate-300">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg shadow-lg overflow-hidden flex flex-col h-full">
      <div className="relative h-40 overflow-hidden">
        <img src={imageSrc} alt={fileName} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-slate-200 break-all pr-2">{fileName}</h3>
          <div className="text-xs font-medium flex-shrink-0">{getStatusIndicator()}</div>
        </div>
        <div className="mt-2 bg-slate-900 rounded-md text-sm flex-grow h-48 overflow-y-auto whitespace-pre-wrap font-mono">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};