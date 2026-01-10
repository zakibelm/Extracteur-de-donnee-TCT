
import React, { useState, useEffect } from 'react';
import { User, SheetRow, Status, TableData, TABLE_HEADERS, ExtractedData, AISettings, DEFAULT_SETTINGS } from './types';
import { extractDataFromImage, optimizeImage } from './services/aiService';
import { gasService } from './services/gasService';
import { AuthPage } from './components/AuthPage';
import { MainContent } from './components/MainContent';
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';

export const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'extract' | 'document' | 'report'>('extract');
  const [unifiedTable, setUnifiedTable] = useState<TableData | null>(null);
  const [globalStatus, setGlobalStatus] = useState<Status>(Status.Idle);

  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('adt_ai_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [extractedResults, setExtractedResults] = useState<ExtractedData[]>([]);

  useEffect(() => {
    localStorage.setItem('adt_ai_settings', JSON.stringify(aiSettings));
  }, [aiSettings]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadData = async (email: string) => {
    if (email === 'demo@adt.logistics') return;
    setLoading(true);
    try {
      const rows = await gasService.fetchUserData(email);
      if (rows.length > 0) {
        const allRows = rows.flatMap(r => r.extracted_data.rows);
        setUnifiedTable({ headers: TABLE_HEADERS, rows: allRows });
        const results: ExtractedData[] = rows.map(d => ({
          id: d.image_id,
          fileName: d.image_id.split('-').slice(1).join('-'),
          imageSrc: "https://via.placeholder.com/300x150/1e293b/e11d48?text=SCAN+ADT",
          content: d.extracted_data,
          status: Status.Success,
          timestamp: new Date(d.timestamp).getTime()
        }));
        setExtractedResults(results);
      }
    } catch (err) {
      setError("Problème de connexion aux serveurs ADT.");
    } finally { setLoading(false); }
  };

  const handleDemoAccess = () => {
    setLoading(true);
    const demoUser: User = { email: 'demo@adt.logistics', name: 'Visiteur Démo', picture: '', numDome: 'DEMO99' };
    setTimeout(() => {
      setUser(demoUser);
      setLoading(false);
    }, 1000);
  };

  const handleExtractAll = async () => {
    if (pendingFiles.length === 0 || !user) return;

    // Réinitialise tous les résultats précédents
    setExtractedResults([]);
    setUnifiedTable(null);
    setError(null);

    setGlobalStatus(Status.Processing);
    const filesToProcess = [...pendingFiles];
    setPendingFiles([]);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);

    const extractionPromises = filesToProcess.map(async (file) => {
      const imageId = `${Date.now()}-${file.name}`;
      const initialResult: ExtractedData = {
        id: imageId, fileName: file.name, imageSrc: URL.createObjectURL(file),
        content: null, status: Status.AiProcessing, timestamp: Date.now()
      };

      // Ajoute au nouvel état vide
      setExtractedResults(prev => [initialResult, ...prev]);

      try {
        const { base64, mimeType } = await optimizeImage(file);
        const extracted = await extractDataFromImage(base64, mimeType, aiSettings);
        if (user.email !== 'demo@adt.logistics') {
          gasService.saveExtraction(user.email, imageId, extracted).catch(console.error);
        }
        setExtractedResults(prev => prev.map(res =>
          res.id === imageId ? { ...res, content: extracted, status: Status.Success } : res
        ));
      } catch (err) {
        setExtractedResults(prev => prev.map(res =>
          res.id === imageId ? { ...res, status: Status.Error } : res
        ));
        setError(`Erreur d'analyse: ${err instanceof Error ? err.message : 'Défaut moteur'}`);
      }
    });

    await Promise.all(extractionPromises);
    setGlobalStatus(Status.Idle);
  };

  if (!user) {
    return <AuthPage onLogin={(u) => setUser(u)} onDemoAccess={handleDemoAccess} />;
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen-fix h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-red-500/30">
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        files={pendingFiles}
        onFileChange={setPendingFiles}
        onRemoveFile={(name) => setPendingFiles(prev => prev.filter(f => f.name !== name))}
        onExtractData={handleExtractAll}
        globalStatus={globalStatus}
        user={user}
        isAdmin={true}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={aiSettings}
        onSave={setAiSettings}
      />

      {isSidebarOpen && window.innerWidth < 1024 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <MainContent
        activeView={activeView}
        setActiveView={setActiveView}
        extractedData={extractedResults}
        onGenerateResults={async () => {
          // Consolider toutes les données extraites avec succès
          const successfulResults = extractedResults.filter(r => r.status === Status.Success && r.content);
          if (successfulResults.length > 0) {
            const allRows = successfulResults.flatMap(r => r.content!.rows);
            const consolidatedTable = { headers: TABLE_HEADERS, rows: allRows };
            setUnifiedTable(consolidatedTable);

            // Export automatique vers Google Sheets
            console.log('🚀 Export automatique Google Sheets...');
            try {
              const { sheetsService } = await import('./services/sheetsService');
              const result = await sheetsService.exportConsolidatedTable(
                user.numDome,
                user.email,
                consolidatedTable
              );
              console.log(result.success ? '✅ Export réussi' : '❌ Export échoué:', result.message);

              // Import automatique depuis Google Sheets après export réussi
              if (result.success) {
                console.log('📥 Import automatique depuis Google Sheets...');
                await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1s pour propagation

                const fetchResult = await sheetsService.fetchFromGoogleSheets(user.numDome);
                if (fetchResult.success && fetchResult.data) {
                  setUnifiedTable(fetchResult.data);
                  console.log('✅ Données chargées depuis Google Sheets:', fetchResult.data.rows.length, 'lignes');
                } else {
                  console.warn('⚠️ Échec import depuis Sheets, utilisation données locales');
                }
              }
            } catch (error) {
              console.error('❌ Erreur export/import:', error);
            }

            setActiveView('document');
          }
        }}
        error={error}
        unifiedTable={unifiedTable}
        onPrint={() => window.print()}
        onDownloadPdf={() => alert("Génération PDF...")}
        onTableUpdate={setUnifiedTable}
        user={user}
        onDeleteResult={(id) => setExtractedResults(prev => prev.filter(r => r.id !== id))}
        isAdmin={true}
        onLogout={() => setUser(null)}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      {loading && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin"></div>
            <p className="text-red-500 font-black uppercase tracking-[0.3em] text-xs">Synchronisation ADT...</p>
          </div>
        </div>
      )}
    </div>
  );
};
