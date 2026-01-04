/**
 * Modern App.tsx - Refactored with Custom Hooks and Modern Design
 * Clean architecture with separation of concerns
 * v2.0 - With Security, Performance & Modern UI
 */
import React, { useState, useEffect, useCallback, memo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ModernSidebar } from './components/ModernSidebar';
import { MainContent } from './components/MainContent';
import { SettingsView } from './components/SettingsView';
import { AuthPage } from './components/AuthPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { ToastContainer, toast } from './components/Toast';
import { useAuth } from './hooks/useAuth';
import { useSettings } from './hooks/useSettings';
import { useResponsive } from './hooks/useResponsive';
import { useExtraction } from './hooks/useExtraction';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Icons } from './components/Icons';

// Set worker path for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@5.4.394/build/pdf.worker.mjs`;

export const App: React.FC = () => {
    // Custom Hooks
    const { currentUser, isAuthenticated, isAdmin, login, logout } = useAuth();
    const { settings, updateSettings } = useSettings();
    const { isMobile, isSidebarOpen, setIsSidebarOpen } = useResponsive();

    // Section State
    const [activeSection, setActiveSection] = useState<'tct' | 'olymel' | 'settings'>('tct');
    const [activeTctView, setActiveTctView] = useState<'extract' | 'document' | 'report'>('extract');
    const [activeOlymelView, setActiveOlymelView] = useState<'extract' | 'calendar' | 'report'>('extract');

    // Accordion State
    const [isTctOpen, setIsTctOpen] = useState(true);
    const [isOlymelOpen, setIsOlymelOpen] = useState(false);

    // Extraction Hooks
    const tctExtraction = useExtraction('tct', currentUser?.numDome);
    const olymelExtraction = useExtraction('olymel', currentUser?.numDome);

    // Load history on auth
    useEffect(() => {
        if (currentUser?.numDome) {
            tctExtraction.loadHistory(currentUser.numDome);
            olymelExtraction.loadHistory(currentUser.numDome);
        }
    }, [currentUser]);

    // Auto-switch to document view for non-admins
    useEffect(() => {
        if (currentUser && !currentUser.isAdmin) {
            if (activeSection === 'tct') {
                setActiveTctView('document');
            } else if (activeSection === 'olymel') {
                setActiveOlymelView('calendar');
            }
        }
    }, [currentUser, activeSection]);

    // Handlers with toast notifications
    const handleLogin = useCallback((user: any) => {
        login(user);
        tctExtraction.loadHistory(user.numDome);
        olymelExtraction.loadHistory(user.numDome);
        toast.success(`Bienvenue ${user.idEmploye} !`);
    }, [login, tctExtraction, olymelExtraction]);

    const handleLogout = useCallback(() => {
        logout();
        tctExtraction.setExtractedData([]);
        olymelExtraction.setExtractedData([]);
        toast.success('Déconnexion réussie');
    }, [logout, tctExtraction, olymelExtraction]);

    const handleTctExtract = useCallback(async () => {
        const toastId = toast.loading('Extraction TCT en cours...');
        try {
            const options = {
                apiKey: settings.openRouterApiKey,
                model: settings.aiModel,
                systemPrompt: settings.systemPromptTct
            };
            await tctExtraction.handleExtractData(options);
            toast.success('Extraction TCT terminée !', { id: toastId });
        } catch (error) {
            toast.error('Échec de l\'extraction TCT', { id: toastId });
        }
    }, [settings, tctExtraction]);

    const handleOlymelExtract = useCallback(async () => {
        const toastId = toast.loading('Extraction Olymel en cours...');
        try {
            const options = {
                apiKey: settings.openRouterApiKey,
                model: settings.aiModel,
                systemPrompt: settings.systemPromptOlymel
            };
            await olymelExtraction.handleExtractData(options);
            toast.success('Extraction Olymel terminée !', { id: toastId });
        } catch (error) {
            toast.error('Échec de l\'extraction Olymel', { id: toastId });
        }
    }, [settings, olymelExtraction]);

    const handlePrint = (headers: string[], rows: string[][]) => {
        const printWindow = window.open('', '', 'height=600,width=800');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Impression - ADT</title>');
            printWindow.document.write('<style>');
            printWindow.document.write(`
                body { font-family: sans-serif; padding: 20px; }
                table { border-collapse: collapse; width: 100%; font-size: 10px; }
                th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
            `);
            printWindow.document.write('</style></head><body>');
            printWindow.document.write('<h1>ADT - Rapport d\'Extraction</h1>');
            printWindow.document.write(`<div class="meta">Généré le ${new Date().toLocaleString()} par ${currentUser?.numDome || 'Inconnu'}</div>`);
            printWindow.document.write('<table>');

            printWindow.document.write('<thead><tr>');
            headers.forEach(h => printWindow.document.write(`<th>${h}</th>`));
            printWindow.document.write('</tr></thead>');

            printWindow.document.write('<tbody>');
            rows.forEach(row => {
                printWindow.document.write('<tr>');
                row.forEach(cell => printWindow.document.write(`<td>${cell}</td>`));
                printWindow.document.write('</tr>');
            });
            printWindow.document.write('</tbody></table>');

            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.print();
        }
    };

    const handleDownloadPdf = useCallback((headers: string[], rows: string[][]) => {
        try {
            toast.loading('Génération du PDF...');
            const doc = new jsPDF({ orientation: 'landscape' });

            doc.setFontSize(14);
            doc.text("ADT - Rapport d'Extraction", 14, 15);
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Généré le : ${new Date().toLocaleString()} par ${currentUser?.numDome}`, 14, 22);

            autoTable(doc, {
                head: [headers],
                body: rows,
                startY: 25,
                styles: { fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [2, 132, 199] },
            });

            doc.save(`ADT_Export_${new Date().toISOString().slice(0, 10)}.pdf`);
            toast.success('PDF généré avec succès !');
        } catch (error) {
            toast.error('Erreur lors de la génération du PDF');
        }
    }, [currentUser]);

    if (!isAuthenticated) {
        return <AuthPage onLogin={handleLogin} />;
    }

    return (
        <ErrorBoundary>
            <ToastContainer />
            <div className="flex flex-col h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans overflow-hidden">
                <div className="flex flex-1 overflow-hidden">
                {/* Sidebar (Admin Only) */}
                {isAdmin && (
                    <ModernSidebar
                        isSidebarOpen={isSidebarOpen}
                        setIsSidebarOpen={setIsSidebarOpen}
                        tctFiles={tctExtraction.files}
                        onTctFileChange={tctExtraction.handleFileChange}
                        onTctExtractData={handleTctExtract}
                        tctGlobalStatus={tctExtraction.globalStatus}
                        isTctOpen={isTctOpen}
                        setIsTctOpen={setIsTctOpen}
                        olymelFiles={olymelExtraction.files}
                        onOlymelFileChange={olymelExtraction.handleFileChange}
                        onOlymelExtractData={handleOlymelExtract}
                        olymelGlobalStatus={olymelExtraction.globalStatus}
                        isOlymelOpen={isOlymelOpen}
                        setIsOlymelOpen={setIsOlymelOpen}
                        user={currentUser!}
                        onLogout={handleLogout}
                        onSectionChange={setActiveSection}
                        activeSection={activeSection}
                    />
                )}

                {/* Mobile Menu Button */}
                {isAdmin && !isSidebarOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="fixed top-4 left-4 z-40 lg:hidden p-3 bg-slate-800/90 backdrop-blur-md text-white rounded-xl shadow-lg border border-slate-700/50 hover:bg-slate-700 transition-all duration-200"
                        aria-label="Open menu"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
                )}

                {/* Main Content */}
                {activeSection === 'settings' ? (
                    <SettingsView settings={settings} onSave={updateSettings} />
                ) : (
                    <MainContent
                        activeSection={activeSection}
                        setActiveSection={(section) => setActiveSection(section as any)}
                        activeTctView={activeTctView}
                        setActiveTctView={setActiveTctView}
                        tctExtractedData={tctExtraction.extractedData}
                        onTctGenerateResults={tctExtraction.handleGenerateResults}
                        tctError={tctExtraction.error}
                        tctUnifiedTable={tctExtraction.unifiedTable}
                        onTctTableUpdate={tctExtraction.handleTableUpdate}
                        onTctDeleteResult={tctExtraction.handleDeleteResult}
                        activeOlymelView={activeOlymelView}
                        setActiveOlymelView={setActiveOlymelView}
                        olymelExtractedData={olymelExtraction.extractedData}
                        onOlymelGenerateResults={olymelExtraction.handleGenerateResults}
                        olymelError={olymelExtraction.error}
                        olymelUnifiedTable={olymelExtraction.unifiedTable}
                        onOlymelTableUpdate={() => {}}
                        onOlymelDeleteResult={olymelExtraction.handleDeleteResult}
                        onPrint={handlePrint}
                        onDownloadPdf={handleDownloadPdf}
                        user={currentUser!}
                        onLogout={handleLogout}
                    />
                )}
                </div>
                <Footer />
            </div>
        </ErrorBoundary>
    );
};
