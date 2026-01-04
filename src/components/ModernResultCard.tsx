import React, { useState } from 'react';
import { ExtractedData, Status } from '../types';
import { Icons } from './Icons';
import { Card } from './ui/Card';

interface ModernResultCardProps {
    data: ExtractedData;
    onDelete: (id: string) => void;
}

export const ModernResultCard: React.FC<ModernResultCardProps> = ({ data, onDelete }) => {
    const { fileName, imageSrc, content, status } = data;
    const [isExpanded, setIsExpanded] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    const getStatusConfig = () => {
        switch (status) {
            case Status.AiProcessing:
                return {
                    icon: <Icons.Sparkles className="w-4 h-4 animate-pulse" />,
                    text: 'Analyse IA...',
                    bgColor: 'bg-sky-500/10',
                    textColor: 'text-sky-400',
                    borderColor: 'border-sky-500/30',
                    dotColor: 'bg-sky-500'
                };
            case Status.Processing:
                return {
                    icon: <Icons.Loader className="w-4 h-4 animate-spin" />,
                    text: 'Traitement...',
                    bgColor: 'bg-blue-500/10',
                    textColor: 'text-blue-400',
                    borderColor: 'border-blue-500/30',
                    dotColor: 'bg-blue-500'
                };
            case Status.Success:
                return {
                    icon: <Icons.CheckCircle className="w-4 h-4" />,
                    text: 'Complété',
                    bgColor: 'bg-emerald-500/10',
                    textColor: 'text-emerald-400',
                    borderColor: 'border-emerald-500/30',
                    dotColor: 'bg-emerald-500'
                };
            case Status.Error:
                return {
                    icon: <Icons.XCircle className="w-4 h-4" />,
                    text: 'Erreur',
                    bgColor: 'bg-red-500/10',
                    textColor: 'text-red-400',
                    borderColor: 'border-red-500/30',
                    dotColor: 'bg-red-500'
                };
            default:
                return {
                    icon: <Icons.Clock className="w-4 h-4" />,
                    text: 'En attente',
                    bgColor: 'bg-slate-500/10',
                    textColor: 'text-slate-400',
                    borderColor: 'border-slate-500/30',
                    dotColor: 'bg-slate-500'
                };
        }
    };

    const statusConfig = getStatusConfig();

    return (
        <Card variant="glass" padding="none" className="group overflow-hidden hover:shadow-2xl transition-all duration-300">
            {/* Image Header with Overlay */}
            <div className="relative h-48 overflow-hidden bg-slate-900">
                <img
                    src={imageSrc}
                    alt={fileName}
                    onLoad={() => setImageLoaded(true)}
                    className={`w-full h-full object-cover transition-all duration-500 ${
                        imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                    } group-hover:scale-110`}
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />

                {/* Status Badge */}
                <div className={`absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full ${statusConfig.bgColor} ${statusConfig.textColor} border ${statusConfig.borderColor} backdrop-blur-md shadow-lg`}>
                    <div className={`w-2 h-2 rounded-full ${statusConfig.dotColor} animate-pulse`} />
                    {statusConfig.icon}
                    <span className="text-xs font-semibold">{statusConfig.text}</span>
                </div>

                {/* Delete Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(data.id);
                    }}
                    className="absolute top-3 right-3 p-2.5 bg-slate-900/80 hover:bg-red-600 text-slate-300 hover:text-white rounded-full transition-all duration-200 backdrop-blur-md shadow-lg opacity-0 group-hover:opacity-100 transform hover:scale-110 active:scale-95"
                    title="Supprimer"
                >
                    <Icons.Trash className="w-4 h-4" />
                </button>

                {/* Expand Button */}
                {status === Status.Success && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="absolute bottom-3 right-3 p-2 bg-slate-900/80 hover:bg-sky-600 text-slate-300 hover:text-white rounded-full transition-all duration-200 backdrop-blur-md shadow-lg opacity-0 group-hover:opacity-100"
                        title={isExpanded ? "Réduire" : "Agrandir"}
                    >
                        {isExpanded ? <Icons.ChevronUp className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="p-5">
                {/* File Name */}
                <div className="flex items-start gap-2 mb-3">
                    <Icons.FileText className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
                    <h3 className="font-semibold text-slate-100 dark:text-slate-100 text-base leading-tight" title={fileName}>
                        {fileName}
                    </h3>
                </div>

                {/* Stats */}
                {status === Status.Success && content && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800/50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400 font-medium">Lignes</span>
                                    <Icons.Hash className="w-3.5 h-3.5 text-slate-500" />
                                </div>
                                <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
                                    {content.rows.length}
                                </p>
                            </div>
                            <div className="bg-slate-800/50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400 font-medium">Colonnes</span>
                                    <Icons.Grid className="w-3.5 h-3.5 text-slate-500" />
                                </div>
                                <p className="text-2xl font-bold text-sky-400 mt-1 font-mono">
                                    {content.headers.length}
                                </p>
                            </div>
                        </div>

                        {/* Preview */}
                        {isExpanded && (
                            <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 animate-slideDown overflow-hidden">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-slate-300">Aperçu des données</span>
                                    <Icons.Table className="w-3.5 h-3.5 text-slate-500" />
                                </div>
                                <div className="overflow-x-auto max-h-40 custom-scrollbar">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-700/50">
                                                {content.headers.slice(0, 3).map((header, i) => (
                                                    <th key={i} className="text-left py-1.5 px-2 text-slate-400 font-semibold whitespace-nowrap">
                                                        {header}
                                                    </th>
                                                ))}
                                                {content.headers.length > 3 && (
                                                    <th className="text-left py-1.5 px-2 text-slate-500">...</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {content.rows.slice(0, 3).map((row, i) => (
                                                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                                    {row.slice(0, 3).map((cell, j) => (
                                                        <td key={j} className="py-1.5 px-2 text-slate-300 whitespace-nowrap">
                                                            {cell || '-'}
                                                        </td>
                                                    ))}
                                                    {row.length > 3 && (
                                                        <td className="py-1.5 px-2 text-slate-500">...</td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {content.rows.length > 3 && (
                                        <p className="text-xs text-slate-500 text-center py-2">
                                            +{content.rows.length - 3} lignes supplémentaires
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Error Message */}
                {status === Status.Error && content?.rows?.[0]?.[0] && (
                    <div className="mt-3 p-3 bg-red-900/20 rounded-lg border border-red-900/30">
                        <div className="flex items-start gap-2">
                            <Icons.AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-400 leading-relaxed">
                                {content.rows[0][0]}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Loading Skeleton */}
            {!imageLoaded && (
                <div className="absolute inset-0 bg-slate-900 animate-pulse" />
            )}
        </Card>
    );
};
