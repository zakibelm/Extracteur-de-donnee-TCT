import React, { useState } from 'react';
import { Icons } from './Icons';

export interface User {
  numDome: string;
  idEmploye: string;
  telephone?: string;
  isAdmin: boolean;
}

interface AuthPageProps {
  onLogin: (user: User) => void;
}

type AccountType = 'admin' | 'driver';
type AuthMode = 'login' | 'signup';

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [accountType, setAccountType] = useState<AccountType>('admin');
  const [numDome, setNumDome] = useState('');
  const [idEmploye, setIdEmploye] = useState('');
  const [telephone, setTelephone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!numDome.trim() || !idEmploye.trim()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const user: User = {
      numDome: numDome.trim(),
      idEmploye: idEmploye.trim(),
      telephone: telephone.trim() || undefined,
      isAdmin: accountType === 'admin' || numDome === '999' || idEmploye === '090'
    };

    localStorage.setItem('edt_user', JSON.stringify(user));
    onLogin(user);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl my-4">
        {/* Tabs */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-t-xl border border-slate-700 border-b-0">
          <div className="flex">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-3 text-base font-semibold transition-all relative ${mode === 'login'
                  ? 'text-emerald-400'
                  : 'text-slate-400 hover:text-slate-300'
                }`}
            >
              CONNEXION
              {mode === 'login' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-400"></div>
              )}
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-3 text-base font-semibold transition-all relative ${mode === 'signup'
                  ? 'text-cyan-400'
                  : 'text-slate-400 hover:text-slate-300'
                }`}
            >
              INSCRIPTION
              {mode === 'signup' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-400"></div>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-b-xl border border-slate-700 p-6">
          {/* Header with gradient - Compact */}
          <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg p-6 mb-5 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl font-bold text-white">ADT</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Bienvenue</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account Type Selection - Compact */}
            <div>
              <h3 className="text-base font-semibold text-slate-200 mb-3">Type de Compte</h3>
              <div className="grid grid-cols-2 gap-3">
                {/* Admin Card */}
                <button
                  type="button"
                  onClick={() => setAccountType('admin')}
                  className={`relative p-4 rounded-lg border-2 transition-all ${accountType === 'admin'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                    }`}
                >
                  {accountType === 'admin' && (
                    <div className="absolute top-2 right-2">
                      <Icons.CheckCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accountType === 'admin' ? 'bg-emerald-500/20' : 'bg-slate-600/50'
                      }`}>
                      <Icons.User className={`w-5 h-5 ${accountType === 'admin' ? 'text-emerald-400' : 'text-slate-400'
                        }`} />
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-semibold ${accountType === 'admin' ? 'text-emerald-400' : 'text-slate-300'
                        }`}>
                        Répartition
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Accès complet</p>
                    </div>
                  </div>
                </button>

                {/* Driver Card */}
                <button
                  type="button"
                  onClick={() => setAccountType('driver')}
                  className={`relative p-4 rounded-lg border-2 transition-all ${accountType === 'driver'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                    }`}
                >
                  {accountType === 'driver' && (
                    <div className="absolute top-2 right-2">
                      <Icons.CheckCircle className="w-5 h-5 text-cyan-400" />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accountType === 'driver' ? 'bg-cyan-500/20' : 'bg-slate-600/50'
                      }`}>
                      <Icons.User className={`w-5 h-5 ${accountType === 'driver' ? 'text-cyan-400' : 'text-slate-400'
                        }`} />
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-semibold ${accountType === 'driver' ? 'text-cyan-400' : 'text-slate-300'
                        }`}>
                        Conducteur
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Routes assignées</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Numéro de Dôme - Compact */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wide">
                Numéro de Dôme
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icons.User className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={numDome}
                  onChange={(e) => setNumDome(e.target.value)}
                  placeholder="Ex: 123"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                  required
                />
              </div>
            </div>

            {/* ID Employé - Compact */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wide">
                ID Employé
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icons.Eye className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={idEmploye}
                  onChange={(e) => setIdEmploye(e.target.value)}
                  placeholder="Votre identifiant unique"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                  required
                />
              </div>
            </div>

            {/* Téléphone (optionnel pour inscription) - Compact */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wide">
                  Téléphone (optionnel)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icons.UploadCloud className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="Ex: 514-123-4567"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                  />
                </div>
              </div>
            )}

            {/* Submit Button - Compact */}
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/30 mt-5"
            >
              {mode === 'login' ? 'Se connecter' : "S'inscrire"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};