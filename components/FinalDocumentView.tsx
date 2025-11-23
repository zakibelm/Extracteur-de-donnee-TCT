
import React, { useState, useMemo, useEffect } from 'react';
import { TableData } from '../types';
import { Button } from './Button';
import { Icons } from './Icons';

interface FinalDocumentViewProps {
    tableData: TableData | null;
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
}

export const FinalDocumentView: React.FC<FinalDocumentViewProps> = ({ tableData, onPrint, onDownloadPdf }) => {
    const [tourneeFilter, setTourneeFilter] = useState('');
    const [vehiculeFilter, setVehiculeFilter] = useState('');
    // État local pour permettre la modification des données (Editable Rows)
    const [rows, setRows] = useState<string[][]>([]);

    // Synchronisation initiale quand les données arrivent du parent
    useEffect(() => {
        if (tableData) {
            // On fait une copie profonde pour éviter les références partagées inattendues, 
            // bien que pour des strings simples, une copie superficielle des tableaux suffise souvent.
            setRows(tableData.rows.map(row => [...row]));
        }
    }, [tableData]);

    const { tourneeIndex, vehiculeIndex, debutTourneeIndex, changementIndex } = useMemo(() => {
        if (!tableData) return { tourneeIndex: -1, vehiculeIndex: -1, debutTourneeIndex: -1, changementIndex: -1 };
        return {
            tourneeIndex: tableData.headers.indexOf('Tournée'),
            vehiculeIndex: tableData.headers.indexOf('Véhicule'),
            debutTourneeIndex: tableData.headers.indexOf('Début tournée'),
            changementIndex: tableData.headers.indexOf('Changement'),
        };
    }, [tableData]);

    // Fonction utilitaire pour convertir les dates/heures en timestamp pour le tri
    const getSortValue = (val: string): number => {
        if (!val) return Number.MAX_SAFE_INTEGER; // Les valeurs vides à la fin
        const s = val.trim();

        // Format complet: DD/MM/YYYY HH:mm
        const fullDateMatch = s.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?\s+(\d{1,2}):(\d{2})$/);
        if (fullDateMatch) {
            const [_, d, m, y, h, min] = fullDateMatch;
            const year = y ? parseInt(y) : new Date().getFullYear();
            return new Date(year, parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min)).getTime();
        }

        // Format heure seule: HH:mm
        const timeMatch = s.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
            const [_, h, min] = timeMatch;
            // On utilise une date de référence (ex: 1970) pour trier les heures entre elles
            return new Date(1970, 0, 1, parseInt(h), parseInt(min)).getTime();
        }

        return Number.MAX_SAFE_INTEGER; // Format inconnu à la fin
    };

    const filteredRows = useMemo(() => {
        if (!rows || rows.length === 0) return [];

        // 1. Filtrage
        let result = rows.filter(row => {
            // Filtre Tournée (Simple include)
            const tourneeMatch = tourneeIndex === -1 || !tourneeFilter || row[tourneeIndex]?.toLowerCase().includes(tourneeFilter.toLowerCase());
            
            // Filtre Véhicule (Supporte le multi-filtre avec '+')
            let vehiculeMatch = true;
            if (vehiculeIndex !== -1 && vehiculeFilter) {
                const cellValue = (row[vehiculeIndex] || '').toLowerCase();
                const searchTerms = vehiculeFilter.split('+').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
                
                if (searchTerms.length > 0) {
                    vehiculeMatch = searchTerms.some(term => cellValue.includes(term));
                }
            }

            return tourneeMatch && vehiculeMatch;
        });

        // 2. Tri par Début tournée (du plus tôt au plus tard)
        if (debutTourneeIndex !== -1) {
            result.sort((a, b) => {
                const valA = getSortValue(a[debutTourneeIndex] || '');
                const valB = getSortValue(b[debutTourneeIndex] || '');
                return valA - valB;
            });
        }

        return result;
    }, [rows, tourneeFilter, vehiculeFilter, tourneeIndex, vehiculeIndex, debutTourneeIndex]);

    const resetFilters = () => {
        setTourneeFilter('');
        setVehiculeFilter('');
    };

    const handleChangementChange = (rowRef: string[], newValue: string) => {
        if (changementIndex !== -1) {
            // Mutation directe de la référence du tableau (performant pour l'édition)
            rowRef[changementIndex] = newValue;
            // On déclenche le re-render en créant une nouvelle référence pour le tableau parent 'rows'
            setRows([...rows]);
        }
    };

    if (!tableData) {
        return <div className="p-8 text-center text-slate-400">Aucune donnée à afficher.</div>;
    }

    return (
        <div className="flex flex-col h-full text-slate-200">
            {/* Toolbar */}
            <div className="flex-shrink-0 p-4 bg-slate-800/50 border-b border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    {/* Filters */}
                    <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 block mb-1">Filtrer par Tournée</label>
                            <input
                                type="text"
                                placeholder="ex: 12345"
                                value={tourneeFilter}
                                onChange={(e) => setTourneeFilter(e.target.value)}
                                className="w-full bg-slate-700 text-slate-200 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                         <div>
                            <label className="text-xs font-semibold text-slate-400 block mb-1">Filtrer par Véhicule (Multi: 220+409)</label>
                            <input
                                type="text"
                                placeholder="ex: 220+409"
                                value={vehiculeFilter}
                                onChange={(e) => setVehiculeFilter(e.target.value)}
                                className="w-full bg-slate-700 text-slate-200 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                    </div>
                    {/* Actions */}
                    <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2">
                         <Button onClick={resetFilters} className="bg-slate-600 hover:bg-slate-500 text-sm py-2 px-3">
                            Réinitialiser
                        </Button>
                         <Button onClick={() => onDownloadPdf(tableData.headers, filteredRows)} className="bg-red-600 hover:bg-red-700 text-sm py-2 px-3">
                            <Icons.FilePdf className="mr-2" /> PDF
                        </Button>
                        <Button onClick={() => onPrint(tableData.headers, filteredRows)} className="bg-slate-500 hover:bg-slate-600 text-sm py-2 px-3">
                            <Icons.Print className="mr-2" /> Imprimer
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-grow overflow-x-auto p-4">
                <div className="border border-slate-700 rounded-md">
                    <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-800/80 backdrop-blur-sm z-10">
                            <tr className="text-slate-300">
                                {tableData.headers.map((header, index) => (
                                    <th key={index} className="p-2 font-semibold border-b border-slate-600 cursor-pointer select-none">
                                        <div className="flex items-center">
                                            {header}
                                            {index === debutTourneeIndex && <Icons.ChevronRight className="w-3 h-3 ml-1 rotate-90" />}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length > 0 ? (
                                filteredRows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="border-t border-slate-700 even:bg-slate-700/30 hover:bg-slate-700/50">
                                        {row.map((cell, cellIndex) => {
                                            // Si c'est la colonne "Changement", on rend un Input
                                            if (cellIndex === changementIndex) {
                                                return (
                                                    <td key={cellIndex} className="p-1">
                                                        <input 
                                                            type="text" 
                                                            value={cell}
                                                            onChange={(e) => handleChangementChange(row, e.target.value)}
                                                            className="w-full bg-slate-900 text-emerald-400 border border-slate-600 rounded px-2 py-1 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                                                        />
                                                    </td>
                                                );
                                            }
                                            // Sinon, affichage standard
                                            return (
                                                <td key={cellIndex} className="p-2 text-slate-300 whitespace-nowrap">{cell}</td>
                                            );
                                        })}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={tableData.headers.length} className="text-center p-8 text-slate-500">
                                        Aucun résultat ne correspond à vos filtres.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
             <div className="flex-shrink-0 p-2 bg-slate-800/50 border-t border-slate-700 text-right text-sm text-slate-400">
                Affiche {filteredRows.length} sur {rows.length} lignes
            </div>
        </div>
    );
};
