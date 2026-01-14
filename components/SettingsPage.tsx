import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { Button } from './Button';
import { User } from './AuthPage';

interface SettingsConfig {
  // API Configuration
  apiProvider: 'gemini' | 'openrouter';
  openrouterApiKey: string;
  openrouterModel: string;
  geminiApiKey: string;
  temperature: number;

  // Display Preferences
  theme: 'dark' | 'light' | 'auto';
  language: 'fr' | 'en';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY';
  fontSize: 'small' | 'medium' | 'large';

  // Notifications
  enableNotifications: boolean;
  enableSounds: boolean;

  // Advanced
  maxRetries: number;
  timeout: number;
}

const DEFAULT_SETTINGS: SettingsConfig = {
  apiProvider: 'openrouter',
  openrouterApiKey: '',
  openrouterModel: 'anthropic/claude-3.5-sonnet',
  geminiApiKey: '',
  temperature: 0.1,
  theme: 'dark',
  language: 'fr',
  dateFormat: 'DD/MM/YYYY',
  fontSize: 'medium',
  enableNotifications: true,
  enableSounds: false,
  maxRetries: 3,
  timeout: 300000,
};

const OPENROUTER_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Recommandé)', cost: '$3/$15 per 1M tokens' },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus (Plus puissant)', cost: '$15/$75 per 1M tokens' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku (Économique)', cost: '$0.25/$1.25 per 1M tokens' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', cost: '$0.35/$1.05 per 1M tokens' },
  { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', cost: '$0.075/$0.30 per 1M tokens' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', cost: '$10/$30 per 1M tokens' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', cost: '$5/$15 per 1M tokens' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', cost: '$0.35/$0.40 per 1M tokens' },
];

interface SettingsPageProps {
  user: User;
  onClose?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ user, onClose }) => {
  const [settings, setSettings] = useState<SettingsConfig>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'api' | 'display' | 'notifications' | 'data' | 'about'>('api');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string>('');

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('edt_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (e) {
      console.error('Erreur chargement paramètres:', e);
      // Si localStorage est corrompu, on le nettoie
      localStorage.removeItem('edt_settings');
      setTestError('Paramètres corrompus nettoyés. Veuillez réentrer votre clé API.');
      setTestStatus('error');
    }
  }, []);

  // Save settings to localStorage
  const handleSave = () => {
    setSaveStatus('saving');
    try {
      localStorage.setItem('edt_settings', JSON.stringify(settings));
      setTimeout(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }, 500);
    } catch (e) {
      console.error('Erreur sauvegarde paramètres:', e);
      setSaveStatus('error');
    }
  };

  const handleReset = () => {
    if (confirm('Voulez-vous vraiment réinitialiser tous les paramètres ?')) {
      setSettings(DEFAULT_SETTINGS);
      localStorage.removeItem('edt_settings');
      setSaveStatus('saved');
    }
  };

  const clearAllData = () => {
    if (confirm('⚠️ ATTENTION: Cela supprimera TOUTES les données extraites (TCT et Olymel). Continuer ?')) {
      localStorage.removeItem('edt_tct_unified_table');
      localStorage.removeItem('edt_olymel_unified_table');
      alert('✅ Toutes les données ont été supprimées.');
    }
  };

  const testApiKey = async () => {
    if (!settings.openrouterApiKey) {
      setTestError('Veuillez entrer une clé API');
      setTestStatus('error');
      return;
    }

    setTestStatus('testing');
    setTestError('');

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${settings.openrouterApiKey}`,
          'HTTP-Referer': window.location.origin,
        }
      });

      if (response.ok) {
        setTestStatus('success');
        setTimeout(() => setTestStatus('idle'), 3000);
      } else {
        const error = await response.json();
        setTestError(error.error?.message || 'Clé API invalide');
        setTestStatus('error');
      }
    } catch (error: any) {
      setTestError(error.message || 'Erreur de connexion');
      setTestStatus('error');
    }
  };

  const renderApiTab = () => (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-bold text-slate-300 mb-3">
          <Icons.Zap className="inline-block w-4 h-4 mr-2" />
          Fournisseur d'IA
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSettings({ ...settings, apiProvider: 'openrouter' })}
            className={`p-4 rounded-lg border-2 transition-all ${
              settings.apiProvider === 'openrouter'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
            }`}
          >
            <div className="font-bold text-sm">OpenRouter</div>
            <div className="text-xs opacity-70 mt-1">Accès à tous les modèles</div>
          </button>
          <button
            onClick={() => setSettings({ ...settings, apiProvider: 'gemini' })}
            className={`p-4 rounded-lg border-2 transition-all ${
              settings.apiProvider === 'gemini'
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
            }`}
          >
            <div className="font-bold text-sm">Gemini Direct</div>
            <div className="text-xs opacity-70 mt-1">API Google native</div>
          </button>
        </div>
      </div>

      {/* OpenRouter Configuration */}
      {settings.apiProvider === 'openrouter' && (
        <>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              Clé API OpenRouter
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-xs text-emerald-400 hover:underline"
              >
                (Obtenir une clé)
              </a>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.openrouterApiKey}
                  onChange={(e) => setSettings({ ...settings, openrouterApiKey: e.target.value })}
                  placeholder="sk-or-v1-..."
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono text-sm pr-10"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showApiKey ? <Icons.EyeOff className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={testApiKey}
                disabled={testStatus === 'testing'}
                className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                  testStatus === 'success'
                    ? 'bg-green-600 text-white'
                    : testStatus === 'error'
                    ? 'bg-red-600 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {testStatus === 'testing' && <Icons.Loader className="w-4 h-4 animate-spin" />}
                {testStatus === 'success' && <Icons.Check className="w-4 h-4" />}
                {testStatus === 'idle' && 'Tester'}
                {testStatus === 'error' && 'Erreur'}
              </button>
            </div>
            {testError && (
              <p className="text-xs text-red-400 mt-2 bg-red-900/20 border border-red-500/30 rounded p-2">
                {testError}
              </p>
            )}
            {testStatus === 'success' && (
              <p className="text-xs text-green-400 mt-2 bg-green-900/20 border border-green-500/30 rounded p-2">
                ✅ Clé API valide!
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Vos données restent privées. La clé est stockée localement dans votre navigateur.
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              <Icons.Cpu className="inline-block w-4 h-4 mr-2" />
              Modèle d'IA
            </label>
            <select
              value={settings.openrouterModel}
              onChange={(e) => setSettings({ ...settings, openrouterModel: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
            >
              {OPENROUTER_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} - {model.cost}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Claude 3.5 Sonnet offre le meilleur rapport qualité/prix pour l'extraction de données.
            </p>
          </div>
        </>
      )}

      {/* Gemini Configuration */}
      {settings.apiProvider === 'gemini' && (
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">
            Clé API Gemini
            <a
              href="https://ai.google.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-xs text-cyan-400 hover:underline"
            >
              (Obtenir une clé)
            </a>
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={settings.geminiApiKey}
              onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
              placeholder="AIza..."
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono text-sm pr-10"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {showApiKey ? <Icons.EyeOff className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Temperature */}
      <div>
        <label className="block text-sm font-bold text-slate-300 mb-2">
          <Icons.Thermometer className="inline-block w-4 h-4 mr-2" />
          Température ({settings.temperature.toFixed(1)})
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={settings.temperature}
          onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>Plus précis</span>
          <span>Plus créatif</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Valeur recommandée: 0.1 pour extraction de données
        </p>
      </div>
    </div>
  );

  const renderDisplayTab = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-bold text-slate-300 mb-3">
          <Icons.Moon className="inline-block w-4 h-4 mr-2" />
          Thème
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(['dark', 'light', 'auto'] as const).map((theme) => (
            <button
              key={theme}
              onClick={() => setSettings({ ...settings, theme })}
              className={`p-3 rounded-lg border-2 transition-all ${
                settings.theme === theme
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              <div className="capitalize text-sm font-medium">{theme}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-300 mb-3">
          <Icons.Globe className="inline-block w-4 h-4 mr-2" />
          Langue
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSettings({ ...settings, language: 'fr' })}
            className={`p-3 rounded-lg border-2 transition-all ${
              settings.language === 'fr'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
            }`}
          >
            🇫🇷 Français
          </button>
          <button
            onClick={() => setSettings({ ...settings, language: 'en' })}
            className={`p-3 rounded-lg border-2 transition-all ${
              settings.language === 'en'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
            }`}
          >
            🇬🇧 English
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-300 mb-3">
          Format de date
        </label>
        <select
          value={settings.dateFormat}
          onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value as any })}
          className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
        >
          <option value="DD/MM/YYYY">JJ/MM/AAAA (Europe)</option>
          <option value="MM/DD/YYYY">MM/JJ/AAAA (US)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-300 mb-3">
          <Icons.Type className="inline-block w-4 h-4 mr-2" />
          Taille de police
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(['small', 'medium', 'large'] as const).map((size) => (
            <button
              key={size}
              onClick={() => setSettings({ ...settings, fontSize: size })}
              className={`p-3 rounded-lg border-2 transition-all ${
                settings.fontSize === size
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              <div className="capitalize text-sm">{size === 'small' ? 'Petite' : size === 'medium' ? 'Moyenne' : 'Grande'}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
        <div>
          <div className="font-bold text-slate-300 text-sm">
            <Icons.Bell className="inline-block w-4 h-4 mr-2" />
            Notifications navigateur
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Recevoir des alertes quand l'extraction est terminée
          </div>
        </div>
        <button
          onClick={() => setSettings({ ...settings, enableNotifications: !settings.enableNotifications })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.enableNotifications ? 'bg-emerald-600' : 'bg-slate-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.enableNotifications ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
        <div>
          <div className="font-bold text-slate-300 text-sm">
            <Icons.Volume2 className="inline-block w-4 h-4 mr-2" />
            Sons système
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Émettre un son lors des événements importants
          </div>
        </div>
        <button
          onClick={() => setSettings({ ...settings, enableSounds: !settings.enableSounds })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.enableSounds ? 'bg-emerald-600' : 'bg-slate-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.enableSounds ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );

  const renderDataTab = () => (
    <div className="space-y-6">
      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="font-bold text-slate-300 text-sm mb-3">
          <Icons.Database className="inline-block w-4 h-4 mr-2" />
          Stockage Local
        </h3>
        <div className="space-y-2 text-sm text-slate-400">
          <div className="flex justify-between">
            <span>Données TCT</span>
            <span className="text-slate-500">
              {localStorage.getItem('edt_tct_unified_table') ? '✅ Présentes' : '❌ Vide'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Données Olymel</span>
            <span className="text-slate-500">
              {localStorage.getItem('edt_olymel_unified_table') ? '✅ Présentes' : '❌ Vide'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Utilisateur</span>
            <span className="text-slate-500">
              {localStorage.getItem('edt_user') ? '✅ Connecté' : '❌ Déconnecté'}
            </span>
          </div>
        </div>
      </div>

      <Button
        onClick={clearAllData}
        className="w-full bg-red-600 hover:bg-red-700"
      >
        <Icons.Trash className="mr-2" />
        Effacer toutes les données
      </Button>

      <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Icons.AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            <p className="font-bold mb-1">Attention</p>
            <p className="text-xs text-amber-300/80">
              La suppression des données est irréversible. Assurez-vous d'avoir exporté vos données importantes avant de continuer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAboutTab = () => (
    <div className="space-y-6">
      <div className="text-center p-8">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-xl mb-4">
          <span className="text-3xl font-bold text-white">ADT</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-200 mb-2">
          ADT - Extracteur de Données
        </h2>
        <p className="text-slate-400 text-sm">Version 1.3.0</p>
      </div>

      <div className="space-y-3">
        <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
          <div className="font-bold text-slate-300 text-sm mb-2">Développé par</div>
          <div className="text-slate-400 text-sm">Zakibelm</div>
        </div>

        <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
          <div className="font-bold text-slate-300 text-sm mb-2">Organisation</div>
          <div className="text-slate-400 text-sm">Taxi Coop Terrebonne</div>
        </div>

        <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
          <div className="font-bold text-slate-300 text-sm mb-2">Technologies</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {['React', 'TypeScript', 'Tailwind', 'Vite', 'OpenRouter', 'Claude AI'].map((tech) => (
              <span
                key={tech}
                className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-xs"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-500 pt-4">
        © 2024 Taxi Coop Terrebonne. Tous droits réservés.
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="flex-none flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Icons.Settings className="w-6 h-6 text-emerald-400" />
          <div>
            <h1 className="text-xl font-bold text-slate-200">Paramètres</h1>
            <p className="text-xs text-slate-500">Configuration de l'application</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Icons.X className="w-5 h-5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-none border-b border-slate-700 bg-slate-800/50">
        <nav className="flex overflow-x-auto">
          {[
            { id: 'api', label: 'API & IA', icon: Icons.Zap },
            { id: 'display', label: 'Affichage', icon: Icons.Monitor },
            { id: 'notifications', label: 'Notifications', icon: Icons.Bell },
            { id: 'data', label: 'Données', icon: Icons.Database },
            { id: 'about', label: 'À propos', icon: Icons.Info },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {activeTab === 'api' && renderApiTab()}
          {activeTab === 'display' && renderDisplayTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {activeTab === 'data' && renderDataTab()}
          {activeTab === 'about' && renderAboutTab()}
        </div>
      </div>

      {/* Footer - Save Button */}
      <div className="flex-none p-4 border-t border-slate-700 bg-slate-800/50">
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {saveStatus === 'saving' && <Icons.Loader className="animate-spin mr-2" />}
            {saveStatus === 'saved' && <Icons.Check className="mr-2" />}
            {saveStatus === 'idle' && <Icons.Save className="mr-2" />}
            {saveStatus === 'saving' ? 'Sauvegarde...' : saveStatus === 'saved' ? 'Sauvegardé !' : 'Sauvegarder'}
          </Button>
          <Button
            onClick={handleReset}
            className="bg-slate-700 hover:bg-slate-600"
          >
            <Icons.RotateCcw className="mr-2" />
            Réinitialiser
          </Button>
        </div>
      </div>
    </div>
  );
};
