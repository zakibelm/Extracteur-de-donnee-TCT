


import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
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
    const viewRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from(".final-doc-anim", {
                opacity: 0,
                y: 20,
                duration: 0.5,
                stagger: 0.15,
                ease: 'power3.out'
            });
        }, viewRef);
        return () => ctx.revert();
    }, []);


    const { tourneeIndex, vehiculeIndex } = useMemo(() => {
        if (!tableData) return { tourneeIndex: -1, vehiculeIndex: -1 };
        return {
            tourneeIndex: tableData.headers.indexOf('Tournée'),
            vehiculeIndex: tableData.headers.indexOf('Véhicule'),
        };
    }, [tableData]);

    const filteredRows = useMemo(() => {
        if (!tableData) return [];

        return tableData.rows.filter(row => {
            const tourneeMatch = tourneeIndex === -1 || !tourneeFilter || row[tourneeIndex]?.toLowerCase().includes(tourneeFilter.toLowerCase());
            const vehiculeMatch = vehiculeIndex === -1 || !vehiculeFilter || row[vehiculeIndex]?.toLowerCase().includes(vehiculeFilter.toLowerCase());
            
            return tourneeMatch && vehiculeMatch;
        });
    }, [tableData, tourneeFilter, vehiculeFilter, tourneeIndex, vehiculeIndex]);

    const resetFilters = () => {
        setTourneeFilter('');
        setVehiculeFilter('');
    };

    if (!tableData) {
        return <div className="p-8 text-center text-[--color-muted-foreground]">Aucune donnée à afficher.</div>;
    }

    return (
        <div ref={viewRef} className="flex flex-col h-full text-[--color-foreground]">
            {/* Toolbar */}
            <div className="final-doc-anim flex-shrink-0 p-4 bg-[--color-card] border-b border-[--color-border]">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    {/* Filters */}
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-[--color-muted-foreground] block mb-1">Filtrer par Tournée</label>
                            <input
                                type="text"
                                placeholder="ex: 12345"
                                value={tourneeFilter}
                                onChange={(e) => setTourneeFilter(e.target.value)}
                                className="w-full bg-[--color-input] text-[--color-foreground] rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[--color-ring]"
                            />
                        </div>
                         <div>
                            <label className="text-xs font-semibold text-[--color-muted-foreground] block mb-1">Filtrer par Véhicule</label>
                            <input
                                type="text"
                                placeholder="ex: ABC-123"
                                value={vehiculeFilter}
                                onChange={(e) => setVehiculeFilter(e.target.value)}
                                className="w-full bg-[--color-input] text-[--color-foreground] rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[--color-ring]"
                            />
                        </div>
                    </div>
                    {/* Actions */}
                    <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2">
                         <Button onClick={resetFilters} className="bg-[--color-muted] text-[--color-muted-foreground] hover:brightness-90 text-sm py-2 px-3">
                            Réinitialiser
                        </Button>
                         <Button onClick={() => onDownloadPdf(tableData.headers, filteredRows)} className="bg-[--color-destructive] text-[--color-destructive-foreground] hover:brightness-90 text-sm py-2 px-3">
                            <Icons.FilePdf className="mr-2" /> PDF
                        </Button>
                        <Button onClick={() => onPrint(tableData.headers, filteredRows)} className="bg-[--color-muted] text-[--color-muted-foreground] hover:brightness-90 text-sm py-2 px-3">
                            <Icons.Print className="mr-2" /> Imprimer
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="final-doc-anim flex-grow overflow-auto p-4">
                <div className="border border-[--color-border] rounded-md overflow-hidden">
                    <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-[--color-card] z-10">
                            <tr className="text-[--color-card-foreground]">
                                {tableData.headers.map((header, index) => (
                                    <th key={index} className="p-2 font-semibold border-b border-[--color-border]">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length > 0 ? (
                                filteredRows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="border-t border-[--color-border] even:bg-[--color-muted] hover:bg-[--color-muted]">
                                        {row.map((cell, cellIndex) => (
                                            <td key={cellIndex} className="p-2 text-[--color-card-foreground] whitespace-nowrap">{cell}</td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={tableData.headers.length} className="text-center p-8 text-[--color-muted-foreground]">
                                        Aucun résultat ne correspond à vos filtres.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
             <div className="final-doc-anim flex-shrink-0 p-2 bg-[--color-card] border-t border-[--color-border] text-right text-sm text-[--color-muted-foreground]">
                Affiche {filteredRows.length} sur {tableData.rows.length} lignes
            </div>
        </div>
    );
};