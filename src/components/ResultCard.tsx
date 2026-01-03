import React from 'react';
import { ExtractedData, Status } from '../types';
import { Icons } from './Icons';

interface ResultCardProps {
    data: ExtractedData;
    onDelete: (id: string) => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ data, onDelete }) => {
    return (
        <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-sm hover:shadow-md transition-shadow relative group">
            <button
                onClick={() => onDelete(data.id)}
                className="absolute top-2 right-2 bg-slate-900/80 p-1 rounded-full text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <Icons.LogOut className="w-4 h-4" /> {/* Using LogOut as Delete icon proxy or I should add Trash */}
            </button>
            <div className="h-32 bg-slate-900 overflow-hidden relative">
                <img src={data.imageSrc} alt={data.fileName} className="w-full h-full object-cover opacity-75" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    {data.status === Status.Processing || data.status === Status.AiProcessing ? (
                        <Icons.Loader className="w-8 h-8 text-emerald-400 animate-spin" />
                    ) : data.status === Status.Success ? (
                        <Icons.CheckCircle className="w-8 h-8 text-emerald-500" />
                    ) : data.status === Status.Error ? (
                        <div className="text-red-500 font-bold">!</div>
                    ) : null}
                </div>
            </div>
            <div className="p-3">
                <h4 className="font-medium text-slate-200 text-sm truncate" title={data.fileName}>
                    {data.fileName}
                </h4>
                <div className="mt-2 flex items-center justify-between text-xs">
                    <span className={`px-2 py-1 rounded-full ${data.status === Status.Success ? 'bg-emerald-500/20 text-emerald-400' :
                            data.status === Status.Error ? 'bg-red-500/20 text-red-400' :
                                'bg-blue-500/20 text-blue-400'
                        }`}>
                        {data.status === Status.Success ? 'Succès' :
                            data.status === Status.Error ? 'Erreur' : 'Traitement...'}
                    </span>
                    {data.content?.rows && (
                        <span className="text-slate-400">
                            {data.content.rows.length} lignes
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
