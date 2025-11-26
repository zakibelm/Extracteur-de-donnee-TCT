
import React, { useState, useMemo, useEffect } from 'react';
import { TableData } from '../types';
import { Button } from './Button';
import { Icons } from './Icons';
import { Modal } from './Modal';
import { User } from './AuthPage';

interface FinalDocumentViewProps {
    tableData: TableData | null;
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
    onTableUpdate: (table: TableData) => void;
    user: User;
}

export const FinalDocumentView: React.FC<FinalDocumentViewProps> = ({ tableData, onPrint, onDownloadPdf, onTableUpdate, user }) => {
    const [tourneeFilter, setTourneeFilter] = useState('');
    const [vehiculeFilter, setVehiculeFilter] = useState('');
    
    // État local pour les lignes
    const [rows, setRows] = useState<string[][]>([]);

    // États pour la gestion de la confirmation
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingChange, setPendingChange] = useState<{
        row: string[];
        oldValue: string;
        newValue: string;
        tournee: string;
    } | null>(null);
    const [focusedValue, setFocusedValue] = useState<string>('');
    const [showLocalWarning, setShowLocalWarning] = useState(true);

    // Synchronisation initiale
    useEffect(() => {
        if (tableData) {
            setRows(tableData.rows.map(row => [...row]));
        }
    }, [tableData]);

    const { tourneeIndex, vehiculeIndex, debutTourneeIndex, changementIndex, changementParIndex, employeIndex } = useMemo(() => {
        if (!tableData) return { tourneeIndex: -1, vehiculeIndex: -1, debutTourneeIndex: -1, changementIndex: -1, changementParIndex: -1, employeIndex: -1 };
        return {
            tourneeIndex: tableData.headers.indexOf('Tournée'),
            vehiculeIndex: tableData.headers.indexOf('Véhicule'),
            debutTourneeIndex: tableData.headers.indexOf('Début tournée'),
            changementIndex: tableData.headers.indexOf('Changement'),
            changementParIndex: tableData.headers.indexOf('Changement par'),
            employeIndex: tableData.headers.indexOf('Employé'),
        };
    }, [tableData]);

    // Fonction de normalisation stricte pour la comparaison d'ID
    const normalizeId = (str: any) => {
        if (!str) return '';
        return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    // --- Logique de Tri et Filtre ---
    const getSortValue = (val: string): number => {
        if (!val) return Number.MAX_SAFE_INTEGER;
        const s = val.trim();
        const fullDateMatch = s.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?\s+(\d{1,2}):(\d{2})$/);
        if (fullDateMatch) {
            const [_, d, m, y, h, min] = fullDateMatch;
            const year = y ? parseInt(y) : new Date().getFullYear();
            return new Date(year, parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min)).getTime();
        }
        const timeMatch = s.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
            const [_, h, min] = timeMatch;
            return new Date(1970, 0, 1, parseInt(h), parseInt(min)).getTime();
        }
        return Number.MAX_SAFE_INTEGER;
    };

    const filteredRows = useMemo(() => {
        if (!rows || rows.length === 0) return [];

        let result = rows.filter(row => {
            const tourneeMatch = tourneeIndex === -1 || !tourneeFilter || row[tourneeIndex]?.toLowerCase().includes(tourneeFilter.toLowerCase());
            
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

        if (debutTourneeIndex !== -1) {
            result.sort((a, b) => {
                const valA = getSortValue(a[debutTourneeIndex] || '');
                const valB = getSortValue(b[debutTourneeIndex] || '');
                return valA - valB;
            });
        }
        return result;
    }, [rows, tourneeFilter, vehiculeFilter, tourneeIndex, vehiculeIndex, debutTourneeIndex]);

    // --- Gestion des Changements ---

    const handleInputFocus = (currentValue: string) => {
        setFocusedValue(currentValue);
    };

    const handleInputChange = (rowRef: string[], newValue: string) => {
        if (changementIndex !== -1) {
            rowRef[changementIndex] = newValue;
            setRows([...rows]); // Force re-render
        }
    };

    const handleInputBlur = (rowRef: string[], newValue: string) => {
        if (newValue === focusedValue) return;

        const tourneeVal = tourneeIndex !== -1 ? rowRef[tourneeIndex] : 'Inconnue';
        
        setPendingChange({
            row: rowRef,
            oldValue: focusedValue,
            newValue: newValue,
            tournee: tourneeVal
        });
        setIsModalOpen(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowRef: string[], newValue: string) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
    };

    const confirmChange = () => {
        if (tableData && pendingChange) {
            // Copie sécurisée pour l'état React
            const rowIndex = rows.indexOf(pendingChange.row);
            
            if (rowIndex !== -1) {
                const newRows = [...rows];
                const newRow = [...newRows[rowIndex]];
                
                // 1. Mettre à jour la colonne Changement
                if (changementIndex !== -1) {
                    newRow[changementIndex] = pendingChange.newValue;
                }
                
                // 2. Mettre à jour la colonne Véhicule (Assignation)
                if (vehiculeIndex !== -1) {
                    newRow[vehiculeIndex] = pendingChange.newValue;
                }

                // 3. Mettre à jour la colonne "Changement par" (Traçabilité 24h)
                if (changementParIndex !== -1) {
                    // Instruction spécifique : "va être num dôme de l utilisateur"
                    newRow[changementParIndex] = user.numDome;
                }
                
                newRows[rowIndex] = newRow;
                setRows(newRows);
                
                // Persistance globale (Local Storage pour la journée)
                const newTable = {
                    ...tableData,
                    rows: newRows
                };
                onTableUpdate(newTable);
            }
        }
        setIsModalOpen(false);
        setPendingChange(null);
        setFocusedValue('');
    };

    const cancelChange = () => {
        if (pendingChange && changementIndex !== -1) {
            pendingChange.row[changementIndex] = pendingChange.oldValue;
            setRows([...rows]);
        }
        setIsModalOpen(false);
        setPendingChange(null);
        setFocusedValue('');
    };

    const resetFilters = () => {
        setTourneeFilter('');
        setVehiculeFilter('');
    };

    if (!tableData) {
        return <div className="p-8 text-center text-slate-400">Aucune donnée à afficher.</div>;
    }

    return (
        <div className="flex flex-col h-full text-slate-200 relative">
            <Modal isOpen={isModalOpen} onClose={cancelChange} title="Confirmer le changement">
                <div className="space-y-4">
                    <p className="text-slate-300">
                        Vous êtes sur le point de modifier le véhicule pour la tournée <span className="font-bold text-white">{pendingChange?.tournee}</span>.
                        <br/>
                        <span className="text-sm text-amber-400 font-bold flex items-center mt-2">
                            <Icons.CheckCircle className="w-4 h-4 mr-1"/>
                            Le véhicule assigné sera automatiquement mis à jour.
                        </span>
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Ancienne valeur</p>
                            <p className="text-red-400 line-through font-mono">{pendingChange?.oldValue || "(Vide)"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Nouvelle valeur</p>
                            <p className="text-emerald-400 font-bold font-mono">{pendingChange?.newValue}</p>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-700">
                        <Button onClick={cancelChange} className="bg-slate-600 hover:bg-slate-500">
                            Annuler
                        </Button>
                        <Button onClick={confirmChange} className="bg-emerald-600 hover:bg-emerald-700">
                            <Icons.CheckCircle className="mr-2" />
                            Valider le changement
                        </Button>
                    </div>
                </div>
            </Modal>
            
            {showLocalWarning && (
                <div className="bg-sky-900/30 border-b border-sky-500/30 p-2 px-4 flex justify-between items-center text-xs text-sky-200">
                    <div className="flex items-center">
                        <Icons.Download className="w-4 h-4 mr-2 text-sky-400" />
                        <span>
                            <strong>Mode Local :</strong> Pour partager ce tableau, 
                            Exportez le fichier JSON (Menu gauche) et envoyez-le à vos utilisateurs.
                        </span>
                    </div>
                    <button onClick={() => setShowLocalWarning(false)} className="text-sky-400 hover:text-white">
                        <Icons.X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="flex-shrink-0 p-4 bg-slate-800/50 border-b border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
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
                                filteredRows.map((row, rowIndex) => {
                                    const rawRowId = vehiculeIndex !== -1 ? row[vehiculeIndex] : '';
                                    const normRowId = normalizeId(rawRowId);
                                    const normUserDome = normalizeId(user?.numDome);
                                    
                                    // Permission basée sur la colonne Véhicule (Assignation)
                                    const isMyTour = normUserDome.length > 0 && normRowId === normUserDome;
                                    
                                    const canEdit = isMyTour;

                                    return (
                                        <tr key={rowIndex} className={`border-t border-slate-700 even:bg-slate-700/30 hover:bg-slate-700/50 ${isMyTour ? 'bg-emerald-900/10' : ''}`}>
                                            {row.map((cell, cellIndex) => {
                                                if (cellIndex === changementIndex) {
                                                    return (
                                                        <td key={cellIndex} className="p-1">
                                                            <div className="relative group">
                                                                <input 
                                                                    type="text" 
                                                                    value={cell}
                                                                    disabled={!canEdit}
                                                                    onFocus={(e) => handleInputFocus(e.target.value)}
                                                                    onChange={(e) => handleInputChange(row, e.target.value)}
                                                                    onBlur={(e) => handleInputBlur(row, e.target.value)}
                                                                    onKeyDown={(e) => handleKeyDown(e, row, (e.target as HTMLInputElement).value)}
                                                                    className={`w-full px-2 py-1 border rounded transition-all
                                                                        ${canEdit 
                                                                            ? 'bg-slate-900 text-emerald-400 border-slate-600 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-text' 
                                                                            : 'bg-slate-800/50 text-slate-500 border-transparent cursor-not-allowed italic'
                                                                        }`}
                                                                    title={canEdit 
                                                                        ? 'Cliquez pour modifier le véhicule' 
                                                                        : `Verrouillé: Assigné au Dôme "${rawRowId}" (Vous êtes "${user?.numDome}")`}
                                                                />
                                                                {!canEdit && (
                                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600">
                                                                        <Icons.Lock className="w-3 h-3" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                }
                                                // Style spécial pour "Changement par"
                                                if (cellIndex === changementParIndex) {
                                                    return (
                                                         <td key={cellIndex} className="p-2 text-sky-400 font-medium whitespace-nowrap text-xs">{cell}</td>
                                                    );
                                                }
                                                return (
                                                    <td key={cellIndex} className="p-2 text-slate-300 whitespace-nowrap">{cell}</td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })
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
