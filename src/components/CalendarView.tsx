
import React, { useState, useMemo, useEffect } from 'react';
import { TableData } from '../types';
import { Button } from './Button';
import {
    Calendar, Clock, Bus, User, Search, MapPin, Filter, LayoutGrid,
    List, ChevronRight, ChevronDown, AlertCircle, CheckSquare, X,
    FileText, Printer, ScanLine, CalendarDays, Columns, GripVertical
} from 'lucide-react';
import { User as UserType } from './AuthPage';

interface CalendarViewProps {
    tableData: TableData | null;
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
    user: UserType;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
    tableData,
    onPrint,
    onDownloadPdf,
    user
}) => {
    // --- STATE ---
    const [activeStatusTab, setActiveStatusTab] = useState<'all' | 'active' | 'off'>('active');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
    const [isDriverDropdownOpen, setIsDriverDropdownOpen] = useState(false);
    const [viewScope, setViewScope] = useState<'day' | 'week'>('week'); // Default to Week for "Full Screen" feel
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // For Day View
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    if (!tableData) return null;
    const { headers, rows } = tableData;

    // --- PARSING INDICES ---
    const dateIndex = headers.findIndex(h => h.toLowerCase().includes('date'));
    const heureIndex = headers.findIndex(h => h.toLowerCase().includes('heure'));
    const transportIndex = headers.findIndex(h => h.toLowerCase().includes('transport'));
    const numeroIndex = headers.findIndex(h => h.toLowerCase().includes('numéro') || h.toLowerCase().includes('numero'));
    const chauffeurIndex = headers.findIndex(h => h.toLowerCase().includes('chauffeur'));

    // --- HELPER: GET STATUS ---
    const getStatus = (row: string[]) => {
        const text = ((row[transportIndex] || '') + ' ' + (row[chauffeurIndex] || '') + ' ' + (row[numeroIndex] || '')).toUpperCase();
        if (text.includes('AUCUN TRANSPORT') || text.includes('CONGE') || text.includes('CONGÉ') || text.includes('VACANCE') || text.includes('OFF') || text.includes('ABSENT')) {
            return 'off';
        }
        return 'active';
    };

    // --- RAW DATA TRANSFORMATION ---
    const RAW_DATA = useMemo(() => {
        return rows.map((row, index) => {
            const dateStr = row[dateIndex] || "Sans date";
            return {
                id: index,
                date: dateStr,
                time: row[heureIndex] || '-',
                route: row[transportIndex] || 'Inconnu',
                bus: row[numeroIndex] || '?',
                driver: row[chauffeurIndex] || 'Inconnu',
                status: getStatus(row),
                fullRow: row
            };
        });
    }, [rows, dateIndex, heureIndex, transportIndex, numeroIndex, chauffeurIndex]);

    // --- UNIQUE LISTS ---
    const drivers = useMemo(() => {
        return [...new Set(RAW_DATA.map(item => item.driver))].filter(d => d && d !== 'Inconnu').sort();
    }, [RAW_DATA]);

    const dates = useMemo(() => {
        // Sort dates logic could be added here if needed, currently relying on extracting order
        // which usually matches chronological order.
        return [...new Set(RAW_DATA.map(item => item.date))];
    }, [RAW_DATA]);

    // --- SELECTED DATE STATE ---
    const [selectedDate, setSelectedDate] = useState<string>("");

    useEffect(() => {
        if (dates.length > 0 && !dates.includes(selectedDate)) {
            setSelectedDate(dates[0]);
        }
    }, [dates]);

    // --- FILTER ACTIONS ---
    const toggleDriver = (driver: string) => {
        setSelectedDrivers(prev =>
            prev.includes(driver) ? prev.filter(d => d !== driver) : [...prev, driver]
        );
    };

    // --- TIME PARSING HELPER (AMÉLIORÉ POUR TRI CHRONOLOGIQUE) ---
    const getMinutes = (timeStr: string) => {
        // Si pas d'heure valide, mettre à la fin (après 24h)
        if (!timeStr || timeStr === '-' || timeStr.trim() === '') return 24 * 60 + 100;

        // Prendre la première heure si format "HH:MM / HH:MM"
        const firstTime = timeStr.split('/')[0].trim().replace('h', ':');

        // Matcher différents formats: "HH:MM", "HH h MM", "HHMM", "HH"
        const parts = firstTime.match(/(\d{1,2})[:h\s]?(\d{2})?/);
        if (!parts) return 24 * 60; // Si format invalide, mettre à la fin

        let hours = parseInt(parts[1]);
        const minutes = parts[2] ? parseInt(parts[2]) : 0;

        // Validation: heures entre 0-23, minutes entre 0-59
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return 24 * 60; // Invalide, mettre à la fin
        }

        return hours * 60 + minutes;
    };

    // --- FILTERED DATA (BASE) ---
    const filteredDataRaw = useMemo(() => {
        return RAW_DATA.filter(item => {
            const matchesSearch =
                item.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.bus.includes(searchTerm) ||
                item.route.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesDriver = selectedDrivers.length > 0 ? selectedDrivers.includes(item.driver) : true;

            const matchesStatus = activeStatusTab === 'all' ? true : activeStatusTab === 'active' ? item.status === 'active' : item.status === 'off';

            return matchesSearch && matchesDriver && matchesStatus;
        });
    }, [searchTerm, selectedDrivers, activeStatusTab, RAW_DATA]);

    // --- GROUPING FOR DAY VIEW ---
    const groupedDataDay = useMemo(() => {
        const dayData = filteredDataRaw.filter(item => item.date === selectedDate);
        // TRI CHRONOLOGIQUE: Du plus tôt au plus tard (00:00 → 23:59)
        dayData.sort((a, b) => getMinutes(a.time) - getMinutes(b.time));

        const groups: { [key: string]: typeof RAW_DATA } = {};

        dayData.forEach(item => {
            let timeKey = item.time;
            if (item.status === 'off' || !item.time || item.time === '-' || item.time.trim() === '') {
                timeKey = 'Repos / Aucun Service';
            }
            if (!groups[timeKey]) groups[timeKey] = [];
            groups[timeKey].push(item);
        });

        const orderedGroups: { time: string; isOff: boolean; items: typeof RAW_DATA }[] = [];
        const processedTimes = new Set<string>();

        dayData.forEach(item => {
            let timeKey = item.time;
            if (item.status === 'off' || !item.time || item.time === '-' || item.time.trim() === '') return;
            if (!processedTimes.has(timeKey)) {
                processedTimes.add(timeKey);
                orderedGroups.push({ time: timeKey, isOff: false, items: groups[timeKey] });
            }
        });

        if (groups['Repos / Aucun Service']) {
            orderedGroups.push({ time: 'Repos / Aucun Service', isOff: true, items: groups['Repos / Aucun Service'] });
        }

        return orderedGroups;
    }, [filteredDataRaw, selectedDate]);

    // --- GROUPING FOR WEEK VIEW ---
    const groupedDataWeek = useMemo(() => {
        const weekGroups: { [key: string]: typeof RAW_DATA } = {};
        dates.forEach(date => {
            weekGroups[date] = filteredDataRaw
                .filter(item => item.date === date)
                // TRI CHRONOLOGIQUE: Du plus tôt au plus tard pour chaque jour
                .sort((a, b) => getMinutes(a.time) - getMinutes(b.time));
        });
        return weekGroups;
    }, [filteredDataRaw, dates]);

    // --- STATS ---
    const stats = {
        total: filteredDataRaw.length,
        active: filteredDataRaw.filter(d => d.status === 'active').length,
        off: filteredDataRaw.filter(d => d.status === 'off').length,
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans selection:bg-rose-500 selection:text-white overflow-hidden">

            {/* Top Navigation Bar - Compact */}
            <nav className="flex-none z-50 bg-slate-900 border-b border-slate-800">
                <div className="max-w-full px-4">
                    <div className="flex items-center justify-between h-14">
                        <div className="flex items-center gap-3">
                            <div className="bg-rose-600 p-1.5 rounded-lg shadow-lg shadow-rose-900/20">
                                <Bus className="w-5 h-5 text-white" />
                            </div>
                            <div className="hidden sm:block">
                                <h1 className="text-lg font-bold text-slate-200 tracking-tight">
                                    Olymel Planning
                                </h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex gap-2 mr-2">
                                <Button onClick={() => onDownloadPdf(headers, rows)} className="bg-red-600 hover:bg-red-700 text-xs py-1.5 px-3 h-8 rounded-md transition-colors">
                                    <FileText className="w-3.5 h-3.5 mr-1.5" /> PDF
                                </Button>
                                <Button onClick={() => onPrint(headers, rows)} className="bg-slate-700 hover:bg-slate-600 text-xs py-1.5 px-3 h-8 rounded-md transition-colors">
                                    <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
                                </Button>
                            </div>

                            <div className="bg-slate-800 rounded-lg p-0.5 border border-slate-700 flex">
                                <button onClick={() => setViewScope('day')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${viewScope === 'day' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                                    <CalendarDays size={14} /> Jour
                                </button>
                                <button onClick={() => setViewScope('week')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${viewScope === 'week' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                                    <Columns size={14} /> Semaine
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="flex-1 flex overflow-hidden">

                {/* SIDEBAR - Collapsible */}
                <div className={`flex-shrink-0 bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-64' : 'w-0 opacity-0 overflow-hidden'}`}>
                    <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">

                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filtres</div>

                        <div className="relative group">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 group-focus-within:text-rose-500 transition-colors" />
                            <input
                                type="text"
                                className="block w-full pl-9 pr-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm transition-all shadow-sm"
                                placeholder="Recherche rapide..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div>
                            <button
                                onClick={() => setIsDriverDropdownOpen(!isDriverDropdownOpen)}
                                className={`w-full flex items-center justify-between bg-slate-800 border rounded-lg px-3 py-2 text-slate-300 transition-all text-sm ${isDriverDropdownOpen ? 'border-rose-500/50' : 'border-slate-700 hover:border-slate-600'}`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <User size={16} className={selectedDrivers.length > 0 ? "text-rose-400" : "text-slate-500"} />
                                    <span className="truncate">
                                        {selectedDrivers.length === 0 ? "Tous les chauffeurs" : `${selectedDrivers.length} sélectionné(s)`}
                                    </span>
                                </div>
                                {isDriverDropdownOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>

                            {isDriverDropdownOpen && (
                                <div className="mt-2 text-sm bg-slate-800 rounded-lg border border-slate-700 shadow-xl overflow-hidden animate-in slide-in-from-top-2">
                                    <div className="p-2 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                                        <span className="text-[10px] uppercase text-slate-500 font-bold">Sélection ({drivers.length})</span>
                                        {selectedDrivers.length > 0 && (
                                            <button onClick={() => setSelectedDrivers([])} className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1">
                                                <X size={10} /> Reset
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-60 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-600">
                                        {drivers.map(driver => (
                                            <label key={driver} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-700/50 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-600 bg-slate-700 text-rose-500 focus:ring-offset-slate-900 focus:ring-rose-500"
                                                    checked={selectedDrivers.includes(driver)}
                                                    onChange={() => toggleDriver(driver)}
                                                />
                                                <span className={`truncate text-xs ${selectedDrivers.includes(driver) ? 'text-rose-200' : 'text-slate-400 group-hover:text-slate-200'}`}>{driver}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                            <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                                <span>Total: {stats.total}</span>
                                <div className="flex gap-2">
                                    <span className="text-emerald-400">{stats.active} ON</span>
                                    <span className="text-slate-500">|</span>
                                    <span className="text-slate-400">{stats.off} OFF</span>
                                </div>
                            </div>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden flex">
                                <div style={{ width: stats.total > 0 ? `${(stats.active / stats.total) * 100}%` : '0%' }} className="bg-emerald-500 h-full"></div>
                            </div>
                        </div>

                    </div>
                    {/* Toggle Sidebar Button Foot */}
                    <div className="p-2 border-t border-slate-800 text-center">
                        <button onClick={() => setIsSidebarOpen(false)} className="text-slate-600 hover:text-slate-400 text-xs flex items-center justify-center gap-1 w-full py-1">
                            <ChevronRight className="rotate-180" size={12} /> Masquer
                        </button>
                    </div>
                </div>

                {/* MAIN BOARD AREA */}
                <div className="flex-1 flex flex-col min-w-0 bg-slate-950/50 relative">

                    {/* Sidebar Toggle (Visible when closed) */}
                    {!isSidebarOpen && (
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="absolute top-4 left-0 z-20 bg-slate-800 border border-slate-700 border-l-0 rounded-r-lg p-1 text-slate-400 hover:text-white shadow-md"
                        >
                            <ChevronRight size={16} />
                        </button>
                    )}

                    {/* Toolbar */}
                    <div className="flex-none p-4 border-b border-slate-800/50 flex flex-wrap items-center justify-between gap-4 bg-slate-950/80 backdrop-blur-sm z-10">
                        {viewScope === 'day' ? (
                            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                                {dates.map((date) => (
                                    <button
                                        key={date}
                                        onClick={() => setSelectedDate(date)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${selectedDate === date ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                                    >
                                        {date}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-slate-200">
                                    Vue d'ensemble
                                </h2>
                                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{dates.length} Jours</span>
                            </div>
                        )}

                        <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                            <button onClick={() => setActiveStatusTab('active')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeStatusTab === 'active' ? 'bg-emerald-900/30 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>Actifs</button>
                            <button onClick={() => setActiveStatusTab('off')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeStatusTab === 'off' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Repos</button>
                            <button onClick={() => setActiveStatusTab('all')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeStatusTab === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Tous</button>
                        </div>
                    </div>

                    {/* Content Viewport */}
                    <div className="flex-1 overflow-hidden relative">

                        {/* --- DAY VIEW --- */}
                        {viewScope === 'day' && (
                            <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6">
                                {groupedDataDay.length > 0 ? (
                                    <div className="space-y-8 max-w-5xl mx-auto">
                                        {groupedDataDay.map((group) => (
                                            <div key={group.time} className="relative pl-6 border-l-2 border-slate-800">
                                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${group.isOff ? 'bg-slate-600' : 'bg-rose-500'}`}></div>
                                                </div>

                                                <div className="flex items-baseline gap-3 mb-4">
                                                    <h3 className={`text-xl font-bold font-mono ${group.isOff ? 'text-slate-500' : 'text-white'}`}>{group.time}</h3>
                                                    {!group.isOff && <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Départ</span>}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                                    {group.items.map((item) => (
                                                        <div key={item.id} className={`group flex flex-col bg-slate-900/50 border rounded-lg p-3 transition-all hover:bg-slate-800 hover:shadow-lg ${item.status === 'active' ? 'border-slate-800 hover:border-rose-500/30' : 'border-slate-800/50 opacity-60'}`}>
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="font-semibold text-slate-200 text-sm truncate pr-2">{item.driver}</span>
                                                                <span className="font-mono text-xs text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">#{item.bus}</span>
                                                            </div>
                                                            <div className="flex items-start gap-2 mt-auto">
                                                                {item.status === 'active' && <MapPin size={12} className="text-orange-500 mt-0.5 flex-shrink-0" />}
                                                                <span className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{item.route}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                        <Filter size={48} className="mb-4 text-slate-700" />
                                        <p>Aucun résultat pour ce jour.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* --- KANBAN WEEK VIEW (BOARD) --- */}
                        {viewScope === 'week' && (
                            <div className="absolute inset-0 overflow-x-auto overflow-y-hidden p-4">
                                <div className="flex h-full gap-4 min-w-full w-max">
                                    {dates.map((date) => (
                                        <div key={date} className="w-[300px] flex-shrink-0 flex flex-col bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden shadow-sm h-full max-h-full">
                                            {/* Column Header */}
                                            <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex-none z-10 sticky top-0 backdrop-blur-sm">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h3 className="font-bold text-slate-200 capitalize text-sm">{date.split(' ')[0]}</h3>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-tight">{date.split(' ').slice(1).join(' ')}</p>
                                                    </div>
                                                    <span className="bg-slate-800 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-mono">
                                                        {groupedDataWeek[date]?.length || 0}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Scrollable Column Body */}
                                            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                                {groupedDataWeek[date] && groupedDataWeek[date].length > 0 ? (
                                                    groupedDataWeek[date].map((item) => (
                                                        <div
                                                            key={item.id}
                                                            className={`p-2.5 rounded-lg border text-left transition-all group ${item.status === 'active'
                                                                ? 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:shadow-md hover:bg-slate-750'
                                                                : 'bg-slate-800/20 border-slate-800/50 opacity-50 hover:opacity-80'
                                                                }`}
                                                        >
                                                            <div className="flex justify-between items-center mb-1.5">
                                                                {item.status === 'active' ? (
                                                                    <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/50">
                                                                        {item.time.split('/')[0]}
                                                                    </span>
                                                                ) : <span className="text-[10px] italic text-slate-600">Repos</span>}

                                                                <span className="text-[10px] font-mono text-slate-500 bg-slate-900/50 px-1.5 py-0.5 rounded">
                                                                    {item.bus !== '?' ? `#${item.bus}` : ''}
                                                                </span>
                                                            </div>

                                                            <div className={`text-sm font-semibold mb-1 truncate ${item.status === 'active' ? 'text-slate-200 group-hover:text-white' : 'text-slate-500'}`}>
                                                                {item.driver}
                                                            </div>

                                                            {item.status === 'active' && (
                                                                <div className="text-[11px] text-slate-500 leading-tight line-clamp-2 group-hover:text-slate-400" title={item.route}>
                                                                    {item.route}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-center py-10 opacity-30">
                                                        <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-2"></div>
                                                        <div className="w-8 h-1 bg-slate-700 rounded-full mx-auto"></div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
