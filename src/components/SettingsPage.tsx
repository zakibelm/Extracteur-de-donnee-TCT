import { DEFAULT_VISION_MODEL, type VisionModel } from '../utils/visionModels';
import { getExtractionKey, setExtractionKey, getExtractionModel } from '../services/extractionSettings';
import { supabase } from '../lib/supabaseClient';
import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { Button } from './Button';

export const SettingsPage: React.FC = () => {
    const [apiKey, setApiKey] = useState('');
    const [selectedModel, setSelectedModel] = useState('openai/gpt-4o-mini');
    const [models, setModels] = useState<VisionModel[]>([]);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [modelsError, setModelsError] = useState('');
    const [modelNotice, setModelNotice] = useState('');
    const [tctPrompt, setTctPrompt] = useState('');
    const [olymelPrompt, setOlymelPrompt] = useState('');
    const [enableRag, setEnableRag] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        const storedApiKey = getExtractionKey();
        localStorage.removeItem('adt_settings_apikey');
        const storedModel = getExtractionModel();
        const storedTctPrompt = localStorage.getItem('adt_settings_prompt_tct') || '';
        const storedOlymelPrompt = localStorage.getItem('adt_settings_prompt_olymel') || '';
        const storedRag = localStorage.getItem('adt_settings_rag') === 'true';

        setApiKey(storedApiKey);
        setSelectedModel(storedModel);
        setTctPrompt(storedTctPrompt);
        setOlymelPrompt(storedOlymelPrompt);
        setEnableRag(storedRag);
    }, []);

    const loadModels = async (signal?: AbortSignal) => {
        setModelsLoading(true);
        setModelsError('');
        try {
            const response = await fetch('/api/models', { signal });
            const data = await response.json();
            if (!response.ok || !Array.isArray(data.models) || !data.models.length) throw new Error(data.error || 'Catalogue vide.');
            setModels(data.models);
            setSelectedModel(current => {
                if (data.models.some((m: VisionModel) => m.id === current)) return current;
                setModelNotice('L’ancien modèle est indisponible ou incompatible. Un modèle vision a été sélectionné ; sauvegardez les modifications.');
                return data.models.some((m: VisionModel) => m.id === DEFAULT_VISION_MODEL) ? DEFAULT_VISION_MODEL : data.models[0].id;
            });
        } catch (error: any) {
            if (signal?.aborted) return;
            setModelsError(error.message || 'Chargement impossible.');
        } finally { if (!signal?.aborted) setModelsLoading(false); }
    };
    useEffect(() => {
        const controller = new AbortController();
        void loadModels(controller.signal);
        return () => controller.abort();
    }, []);
    const modelReady = !modelsLoading && !modelsError && models.some(m => m.id === selectedModel);

    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    const handleTestKey = async () => {
        if (!modelReady) return;
        if (!apiKey) {
            setTestStatus('error');
            setTestMessage('Veuillez entrer une clé API pour tester.');
            return;
        }

        setTestStatus('testing');
        setTestMessage('');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Session expirée.');
            const response = await fetch('/api/extract', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                    Authorization: `Bearer ${session.access_token}`,
                    'X-Model': selectedModel
                },
                body: JSON.stringify({
                    prompt: "Réponds seulement 'OK' si tu me reçois.",
                    temperature: 0.1
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.details || 'Erreur inconnue');
            }

            setTestStatus('success');
            setTestMessage('Test réussi : ce modèle a répondu à une requête avec une image de test.');
        } catch (error: any) {
            console.error("Test Error:", error);
            setTestStatus('error');
            setTestMessage(error.message || 'Échec de la connexion.');
        }
    };

    const handleSave = () => {
        if (!modelReady) return;
        setExtractionKey(apiKey);
        localStorage.setItem('adt_settings_model', selectedModel);
        localStorage.setItem('adt_settings_prompt_tct', tctPrompt);
        localStorage.setItem('adt_settings_prompt_olymel', olymelPrompt);
        localStorage.setItem('adt_settings_rag', String(enableRag));

        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    return (
        <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-3xl mx-auto bg-slate-800 rounded-lg border border-slate-700 shadow-xl p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
                    <div className="p-2 bg-indigo-600 rounded-lg text-white">
                        <Icons.Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Paramètres de l'Application</h2>
                        <p className="text-sm text-slate-400">Configurez les clés API et les modèles d'IA</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* API Key Section */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Clé API OpenRouter
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="sk-or-..."
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm"
                                />
                                <div className="absolute right-3 top-2.5 text-slate-500">
                                    <Icons.Lock className="w-4 h-4" />
                                </div>
                            </div>
                            <Button
                                onClick={handleTestKey}
                                disabled={testStatus === 'testing' || !apiKey || !modelReady}
                                className={`whitespace-nowrap ${testStatus === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : testStatus === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-600'}`}
                            >
                                {testStatus === 'testing' ? (
                                    <Icons.Loader className="w-4 h-4 animate-spin" />
                                ) : testStatus === 'success' ? (
                                    <Icons.CheckCircle className="w-4 h-4" />
                                ) : testStatus === 'error' ? (
                                    <Icons.XCircle className="w-4 h-4" />
                                ) : (
                                    <Icons.Zap className="w-4 h-4 mr-2" />
                                )}
                                {testStatus === 'testing' ? '' : 'Tester'}
                            </Button>
                        </div>
                        {testMessage && (
                            <p className={`text-xs mt-2 ${testStatus === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {testMessage}
                            </p>
                        )}
                        <p className="text-xs text-slate-500 mt-1.5">
                            Cette clé active l’analyse pour cet onglet. Elle est effacée à la déconnexion ou au rechargement.
                        </p>
                    </div>

                    {/* Model Selection */}
                    <div>
                        <label htmlFor="vision-model" className="block text-sm font-medium text-slate-300 mb-2">
                            Modèle d'IA — vision
                        </label>
                        <select
                            value={selectedModel}
                            id="vision-model"
                            disabled={modelsLoading || !!modelsError}
                            onChange={(e) => { setSelectedModel(e.target.value); setTestStatus('idle'); setTestMessage(''); }}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm appearance-none"
                        >
                            {modelsLoading && <option>Chargement des modèles…</option>}
                            {!modelsLoading && !models.length && <option>Catalogue indisponible</option>}
                            {models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                        </select>
                        <p className="text-xs text-slate-500 mt-1.5">
                            Catalogue OpenRouter actualisé automatiquement. Seuls les modèles lisant les images sont proposés, du plus récent au plus ancien. Les tarifs varient selon le modèle.
                        </p>
                    </div>

                    {modelsError && <p role="alert" className="text-sm text-red-400">{modelsError}</p>}
                    {modelNotice && <p role="status" className="text-sm text-amber-300">{modelNotice}</p>}
                    <Button onClick={() => void loadModels()} disabled={modelsLoading}>Actualiser la liste</Button>

                    {/* RAG Option */}
                    <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                        <div>
                            <h3 className="text-sm font-medium text-slate-200">Activer le RAG (Retrieval-Augmented Generation)</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Améliore la précision en fournissant du contexte supplémentaire (peut ralentir le traitement).
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enableRag}
                                onChange={(e) => setEnableRag(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {/* System Prompts Section */}
                    <div>
                        <h3 className="text-sm font-medium text-slate-300 mb-4">Prompts Système (Instructions)</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 uppercase font-bold tracking-wider">
                                    TCT (Logistique)
                                </label>
                                <textarea
                                    value={tctPrompt}
                                    onChange={(e) => setTctPrompt(e.target.value)}
                                    placeholder="Laissez vide pour utiliser l'instruction par défaut."
                                    rows={3}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 uppercase font-bold tracking-wider">
                                    Olymel (Transport)
                                </label>
                                <textarea
                                    value={olymelPrompt}
                                    onChange={(e) => setOlymelPrompt(e.target.value)}
                                    placeholder="Laissez vide pour utiliser l'instruction par défaut."
                                    rows={3}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-700 mt-6">
                        {showSuccess && (
                            <span className="text-emerald-400 text-sm font-medium animate-fade-in flex items-center">
                                <Icons.CheckCircle className="w-4 h-4 mr-1.5" />
                                Paramètres sauvegardés !
                            </span>
                        )}
                        <Button
                            onClick={handleSave}
                            disabled={!modelReady}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6"
                        >
                            Sauvegarder les modifications
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
