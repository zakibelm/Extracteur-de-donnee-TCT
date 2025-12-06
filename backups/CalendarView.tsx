
import React, { useMemo, useState } from 'react';
import { TableData } from '../types';
import { Button } from './Button';
import { Icons } from './Icons';
import { User } from './AuthPage';

interface CalendarViewProps {
    tableData: TableData | null;
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
    user: User;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
    tableData,
    onPrint,
    onDownloadPdf,
    user
}) => {
    const [selectedDate, setSelectedDate] = useState<string>('');

    if (!tableData) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <Icons.ClipboardList className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-slate-400">Aucune donnée Olymel</h2>
                    <p className="text-slate-500 mt-2">Lancez l'extraction depuis la sidebar Olymel</p>
                </div>
            </div>
        );
    }

    const { headers, rows } = tableData;

    // Trouver les index des colonnes Olymel
    const dateIndex = headers.findIndex(h => h.toLowerCase().includes('date'));
    const heureIndex = headers.findIndex(h => h.toLowerCase().includes('heure'));
    const transportIndex = headers.findIndex(h => h.toLowerCase().includes('transport'));
    const numeroIndex = headers.findIndex(h => h.toLowerCase().includes('numéro') || h.toLowerCase().includes('numero'));
    const chauffeurIndex = headers.findIndex(h => h.toLowerCase().includes('chauffeur'));

    // Grouper les données par date
    const eventsByDate = useMemo(() => {
        const grouped: { [date: string]: any[] } = {};

        rows.forEach((row, index) => {
            let dateKey = 'Sans date';

            // Extraire la date de la colonne Date
            if (dateIndex !== -1 && row[dateIndex]) {
                const dateValue = row[dateIndex].trim();
                if (dateValue) {
                    dateKey = dateValue;
                }
            }

            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }

            grouped[dateKey].push({
                index,
                date: row[dateIndex] || '',
                heure: row[heureIndex] || '',
                transport: row[transportIndex] || '',
                numero: row[numeroIndex] || '',
                chauffeur: row[chauffeurIndex] || '',
                fullRow: row
            });
        });

        // Trier les événements par heure dans chaque date
        Object.keys(grouped).forEach(dateKey => {
            grouped[dateKey].sort((a, b) => {
                const timeA = a.heure.trim();
                const timeB = b.heure.trim();

                // Convertir HH:mm en minutes pour comparaison
                const parseTime = (time: string) => {
                    const match = time.match(/(\d{1,2}):(\d{2})/);
                    if (match) {
                        return parseInt(match[1]) * 60 + parseInt(match[2]);
                    }
                    return 0;
                };

                return parseTime(timeA) - parseTime(timeB);
            });
        });

        return grouped;
    }, [rows, dateIndex, heureIndex, transportIndex, numeroIndex, chauffeurIndex]);

    // Trier les dates par ordre de jour de semaine (lundi → vendredi)
    const dates = useMemo(() => {
        const dayOrder: { [key: string]: number } = {
            'lundi': 1,
            'mardi': 2,
            'mercredi': 3,
            'jeudi': 4,
            'vendredi': 5,
            'samedi': 6,
            'dimanche': 7
        };

        return Object.keys(eventsByDate).sort((a, b) => {
            // Extraire le nom du jour (premier mot en minuscules)
            const dayA = a.toLowerCase().split(' ')[0];
            const dayB = b.toLowerCase().split(' ')[0];

            const orderA = dayOrder[dayA] || 999;
            const orderB = dayOrder[dayB] || 999;

            return orderA - orderB;
        });
    }, [eventsByDate]);

    return (
        <div className="flex flex-col h-full bg-slate-900">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-200">Calendrier Olymel</h2>
                        <p className="text-slate-400 text-sm mt-1">Agenda des assignations</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => onDownloadPdf(headers, rows)} className="bg-red-600 hover:bg-red-700 text-sm py-2 px-3">
                            <Icons.FilePdf className="mr-2" /> PDF
                        </Button>
                        <Button onClick={() => onPrint(headers, rows)} className="bg-slate-500 hover:bg-slate-600 text-sm py-2 px-3">
                            <Icons.Print className="mr-2" /> Imprimer
                        </Button>
                    </div>
                </div>

                {/* Sélecteur de date */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {dates.map(date => (
                        <button
                            key={date}
                            onClick={() => setSelectedDate(date)}
                            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${selectedDate === date
                                    ? 'bg-cyan-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            {date}
                            <span className="ml-2 text-xs opacity-75">
                                ({eventsByDate[date].length})
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Calendar Content */}
            <div className="flex-grow overflow-y-auto p-6">
                {selectedDate ? (
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-slate-300 mb-4">
                            Assignations du {selectedDate}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {eventsByDate[selectedDate]?.map((event, idx) => (
                                <div
                                    key={idx}
                                    className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-cyan-500 transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <h4 className="font-bold text-slate-200 text-sm">
                                            {event.transport}
                                        </h4>
                                        <div className="text-xs text-cyan-400 font-mono">
                                            {event.heure}
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        {event.chauffeur && (
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Icons.User className="w-4 h-4" />
                                                <span>{event.chauffeur}</span>
                                            </div>
                                        )}
                                        {event.numero && (
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Icons.UploadCloud className="w-4 h-4" />
                                                <span>Véhicule #{event.numero}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <Icons.ClipboardList className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-400">Sélectionnez une date</h3>
                            <p className="text-slate-500 mt-2">Choisissez une date ci-dessus pour voir les assignations</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
