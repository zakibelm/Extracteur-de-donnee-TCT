
import React, { useState } from 'react';
import { AISettings, TABLE_HEADERS } from '../types';
import { Icons } from './Icons';
import { Modal } from './Modal';
import { validateOpenRouterKey } from '../services/aiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (settings: AISettings) => void;
}

const POPULAR_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Anthropic)', provider: 'Best for Data' },
  { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash (Google)', provider: 'Fast & Cheap' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large 2 (Mistral)', provider: 'Strong Logic' },
  { id: 'moonshotai/moonshot-v1-8k', name: 'Kimi V1 (Moonshot)', provider: 'High Precision' },
  { id: 'openai/gpt-4o', name: 'GPT-4o (OpenAI)', provider: 'All-rounder' },
  { id: 'meta-llama/llama-3.1-405b', name: 'Llama 3.1 405B (Meta)', provider: 'Open weights' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = React.useState<AISettings>(settings);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [showCustomModel, setShowCustomModel] = useState(!POPULAR_MODELS.find(m => m.id === settings.modelId));

  React.useEffect(() => {
    setLocalSettings(settings);
    setTestStatus('idle');
    setShowCustomModel(!POPULAR_MODELS.find(m => m.id === settings.modelId));
  }, [settings, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localSettings);
    onClose();
  };

  const handleTestKey = async () => {
    if (!localSettings.openRouterKey) return;
    setTestStatus('testing');
    const isValid = await validateOpenRouterKey(localSettings.openRouterKey);
    setTestStatus(isValid ? 'success' : 'error');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configuration Moteur IA">
      <form onSubmit={handleSubmit} className="space-y-6 p-2">
        <div className="space-y-4">
          {/* Clé OpenRouter */}
          <div>
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Clé API OpenRouter</label>
            <div className="flex gap-2">
              <div className="relative group flex-grow">
                <Icons.Database className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700 group-focus-within:text-red-500 transition-colors" />
                <input 
                  type="password" 
                  value={localSettings.openRouterKey}
                  onChange={(e) => {
                    setLocalSettings({...localSettings, openRouterKey: e.target.value});
                    setTestStatus('idle');
                  }}
                  placeholder="sk-or-v1-..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-xs text-white focus:outline-none focus:border-red-500/40 transition-all"
                />
              </div>
              <button
                type="button"
                onClick={handleTestKey}
                disabled={!localSettings.openRouterKey || testStatus === 'testing'}
                className={`px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center min-w-[100px]
                  ${testStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 
                    testStatus === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-500' : 
                    'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'}`}
              >
                {testStatus === 'testing' ? <Icons.Loader className="animate-spin w-4 h-4" /> : 
                 testStatus === 'success' ? 'Valide' : 
                 testStatus === 'error' ? 'Invalide' : 'Tester'}
              </button>
            </div>
          </div>

          {/* Choix du Modèle */}
          <div>
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Choix du Modèle AI</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
              {POPULAR_MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    setLocalSettings({...localSettings, modelId: model.id});
                    setShowCustomModel(false);
                  }}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${localSettings.modelId === model.id && !showCustomModel ? 'bg-red-500/10 border-red-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                >
                  <span className="text-[11px] font-bold">{model.name}</span>
                  <span className="text-[9px] opacity-60 uppercase tracking-tighter">{model.provider}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowCustomModel(true)}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${showCustomModel ? 'bg-zinc-800 border-zinc-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
              >
                <span className="text-[11px] font-bold">Autre Modèle (Custom)</span>
                <span className="text-[9px] opacity-60 uppercase tracking-tighter">Saisie manuelle</span>
              </button>
            </div>

            {showCustomModel && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <input 
                  type="text" 
                  value={localSettings.modelId}
                  onChange={(e) => setLocalSettings({...localSettings, modelId: e.target.value})}
                  placeholder="Ex: anthropic/claude-2"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-red-500/40 transition-all shadow-inner"
                />
                <p className="text-[9px] text-zinc-600 mt-2 italic px-1">Entrez l'identifiant exact fourni par OpenRouter (ex: mistralai/mistral-medium).</p>
              </div>
            )}
          </div>

          {/* Prompt Système */}
          <div>
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Instructions de l'Agent IA</label>
            <textarea 
              rows={4}
              value={localSettings.systemPrompt}
              onChange={(e) => setLocalSettings({...localSettings, systemPrompt: e.target.value})}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-[11px] leading-relaxed text-zinc-300 focus:outline-none focus:border-red-500/40 transition-all resize-none font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-zinc-800 text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all"
          >
            Annuler
          </button>
          <button 
            type="submit"
            className="px-8 py-2.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 shadow-lg shadow-red-900/20 transition-all"
          >
            Appliquer
          </button>
        </div>
      </form>
    </Modal>
  );
};
