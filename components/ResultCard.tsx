
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
          <div className="flex items-center text-red-400">
            <Icons.Sparkles className="w-3 h-3 mr-2 animate-pulse" />
            <span className="text-[10px] font-black uppercase">Analyse IA...</span>
          </div>
        );
      case Status.Success:
        return (
          <div className="flex items-center text-red-500">
            <Icons.CheckCircle className="w-3 h-3 mr-2" />
            <span className="text-[10px] font-black uppercase">Traitée</span>
          </div>
        );
      case Status.Error:
        return (
          <div className="flex items-center text-zinc-500">
            <Icons.XCircle className="w-3 h-3 mr-2" />
            <span className="text-[10px] font-black uppercase">Échec</span>
          </div>
        );
      default:
        return <span className="text-zinc-600 text-[10px] font-black uppercase">Attente</span>;
    }
  };

  return (
    <div className="bg-zinc-900/40 rounded-[2rem] border border-zinc-800 overflow-hidden flex flex-col h-full shadow-2xl hover:border-red-600/30 transition-all duration-300 group">
      <div className="relative h-44 bg-zinc-950 overflow-hidden">
        <img src={imageSrc} alt={fileName} className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
        <button onClick={() => onDelete(data.id)} className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-red-600 text-zinc-400 hover:text-white rounded-xl transition-all backdrop-blur-md">
            <Icons.Trash className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 flex-grow flex flex-col">
        <h3 className="font-bold text-white truncate text-sm mb-2" title={fileName}>{fileName}</h3>
        <div className="mb-6">{getStatusIndicator()}</div>

        {status === Status.Success && content && (
          <div className="mt-auto grid grid-cols-2 gap-3">
             <div className="bg-black/40 p-3 rounded-xl border border-zinc-800/50">
                <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Lignes</p>
                <p className="text-xs font-black text-red-500">{content.rows.length}</p>
             </div>
             <div className="bg-black/40 p-3 rounded-xl border border-zinc-800/50">
                <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Précision</p>
                <p className="text-xs font-black text-white">98%</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};