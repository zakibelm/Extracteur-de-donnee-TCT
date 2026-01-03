import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { Button } from './Button';

export interface AppSettings {
    openRouterApiKey: string;
    aiModel: string;
    enableRag: boolean;
    systemPromptTct: string;
    systemPromptOlymel: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
    openRouterApiKey: '',
    aiModel: 'google-gemini-2.0-flash-free',
    enableRag: false,
    systemPromptTct: '',
    systemPromptOlymel: ''
};

interface SettingsViewProps {
    settings: AppSettings;
    onSave: (settings: AppSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave }) => {
    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
    const [showKey, setShowKey] = useState(false);

    // Sync local state if props change (e.g. initial load)
    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleChange = (field: keyof AppSettings, value: any) => {
        setLocalSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = () => {
        onSave(localSettings);
        // Optional: Show a toast or notification
        alert("Paramètres sauvegardés !");
    };

    return (
        <div className="p-6 max-w-4xl mx-auto w-full">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 shadow-xl">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-lg bg-indigo-600 flex items-center justify-center">
                        <Icons.Settings className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Paramètres de l'Application</h2>
                        <p className="text-slate-400">Configurez les clés API et les modèles d'IA</p>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* API Key Section */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Clé API OpenRouter
                        </label>
                        <div className="relative">
                            <input
                                type={showKey ? "text" : "password"}
                                value={localSettings.openRouterApiKey}
                                onChange={(e) => handleChange('openRouterApiKey', e.target.value)}
                                placeholder="sk-or-..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 px-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                {showKey ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            Cette clé est stockée localement dans votre navigateur et utilisée pour toutes les requêtes d'extraction.
                        </p>
                    </div>

                    {/* Model Section */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Modèle d'IA
                        </label>
                        <select
                            value={localSettings.aiModel}
                            onChange={(e) => handleChange('aiModel', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none"
                        >
                            <option value="google-gemini-2.0-flash-free">Google Gemini 2.0 Flash (Gratuit)</option>
                            <option value="google-gemini-pro-1.5">Google Gemini Pro 1.5</option>
                            <option value="openai-gpt-4o">OpenAI GPT-4o</option>
                            <option value="anthropic-claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                        </select>
                        <p className="mt-2 text-xs text-slate-500">
                            Le modèle choisi influencera la qualité et la vitesse de l'extraction.
                        </p>
                    </div>

                    {/* RAG Toggle */}
                    <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                        <div>
                            <h3 className="font-medium text-slate-200">Activer le RAG (Retrieval-Augmented Generation)</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Améliore la précision en fournissant du contexte supplémentaire (peut ralentir le traitement).
                            </p>
                        </div>
                        <button
                            onClick={() => handleChange('enableRag', !localSettings.enableRag)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${localSettings.enableRag ? 'bg-indigo-600' : 'bg-slate-700'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.enableRag ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* System Prompts */}
                    <div>
                        <h3 className="text-sm font-medium text-slate-300 mb-4">Prompts Système (Instructions)</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    TCT (Logistique)
                                </label>
                                <textarea
                                    rows={4}
                                    value={localSettings.systemPromptTct}
                                    onChange={(e) => handleChange('systemPromptTct', e.target.value)}
                                    placeholder="Laissez vide pour utiliser l'instruction par défaut."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 px-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none font-mono text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    Olymel (Transport)
                                </label>
                                <textarea
                                    rows={4}
                                    value={localSettings.systemPromptOlymel}
                                    onChange={(e) => handleChange('systemPromptOlymel', e.target.value)}
                                    placeholder="Laissez vide pour utiliser l'instruction par défaut."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 px-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none font-mono text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-700 flex justify-end">
                    <Button
                        onClick={handleSave}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-8 rounded-lg shadow-lg shadow-indigo-500/20"
                    >
                        Sauvegarder les paramètres
                    </Button>
                </div>
            </div>
        </div>
    );
};
