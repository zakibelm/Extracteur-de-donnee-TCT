import React, { useState } from 'react';
import { User as UserIcon, Car, CheckCircle, AlertCircle, Loader, Mail, Lock, Hash, CreditCard } from 'lucide-react';
import { authService } from '../services/authService';
import { User } from '../types';

interface AuthPageProps {
  onLogin: (user: User) => void;
}

type AccountType = 'admin' | 'driver';
type AuthMode = 'login' | 'signup';

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  console.log('🔐 AuthPage is rendering...');
  const [mode, setMode] = useState<AuthMode>('login');
  const [accountType, setAccountType] = useState<AccountType>('admin');

  // Login fields
  const [loginEmployeeId, setLoginEmployeeId] = useState('');
  const [password, setPassword] = useState('');

  // Signup fields
  const [numDome, setNumDome] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [telephone, setTelephone] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'login') {
      if (!loginEmployeeId.trim() || !password.trim()) {
        setError('Veuillez remplir tous les champs obligatoires');
        return;
      }
    } else {
      if (!numDome.trim() || !employeeId.trim() || !email.trim() || !signupPassword.trim() || !telephone.trim()) {
        setError('Veuillez remplir tous les champs obligatoires');
        return;
      }
    }

    setIsLoading(true);

    try {
      let user: User;
      if (mode === 'login') {
        user = await authService.login(loginEmployeeId.trim(), password.trim());
      } else {
        user = await authService.signup(
          numDome.trim(),
          employeeId.trim(),
          email.trim(),
          signupPassword.trim(),
          accountType,
          telephone.trim()
        );
      }

      // Success
      localStorage.setItem('edt_user', JSON.stringify(user));
      onLogin(user);

    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-md animate-in slide-in-from-bottom-4 duration-500">

        {/* Main Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">

          {/* Header Area */}
          <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 p-6 border-b border-slate-800">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-3 shadow-inner border border-slate-700">
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 to-cyan-400">ADT</span>
              </div>
              <h1 className="text-xl font-bold text-slate-100">Bienvenue</h1>
              <p className="text-xs text-slate-500 mt-1">Connectez-vous pour accéder au portail</p>
            </div>
          </div>

          {/* Tabs - Compact */}
          <div className="flex border-b border-slate-800 bg-slate-900/50">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors relative ${mode === 'login' ? 'text-emerald-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}
            >
              Connexion
              {mode === 'login' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>}
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors relative ${mode === 'signup' ? 'text-cyan-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}
            >
              Inscription
              {mode === 'signup' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>}
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-2 text-red-200 text-xs animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Account Type Selection - Only for Signup */}
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                <button
                  type="button"
                  onClick={() => setAccountType('admin')}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${accountType === 'admin'
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-100'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                    }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accountType === 'admin' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
                    <UserIcon size={16} />
                  </div>
                  <div className="text-left">
                    <div className={`text-xs font-bold ${accountType === 'admin' ? 'text-emerald-400' : 'text-slate-300'}`}>Répartition</div>
                    <div className="text-[10px] opacity-70">Accès total</div>
                  </div>
                  {accountType === 'admin' && <CheckCircle size={14} className="ml-auto text-emerald-500" />}
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType('driver')}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${accountType === 'driver'
                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-100'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                    }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accountType === 'driver' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
                    <Car size={16} />
                  </div>
                  <div className="text-left">
                    <div className={`text-xs font-bold ${accountType === 'driver' ? 'text-cyan-400' : 'text-slate-300'}`}>Conducteur</div>
                    <div className="text-[10px] opacity-70">Routes</div>
                  </div>
                  {accountType === 'driver' && <CheckCircle size={14} className="ml-auto text-cyan-500" />}
                </button>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' && (
              <div className="space-y-3 pt-2">
                {/* ID Employé */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CreditCard size={18} className="text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={loginEmployeeId}
                    onChange={(e) => setLoginEmployeeId(e.target.value)}
                    placeholder="ID Employé"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-mono"
                    required
                  />
                </div>

                {/* Mot de passe */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className="text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mot de passe"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                    required
                  />
                </div>
              </div>
            )}

            {/* SIGNUP FORM */}
            {mode === 'signup' && (
              <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2">

                {/* Numéro de Dôme */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Car size={18} className="text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={numDome}
                    onChange={(e) => setNumDome(e.target.value)}
                    placeholder="Numéro de Dôme"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm font-mono"
                    required
                  />
                </div>

                {/* ID Employé */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CreditCard size={18} className="text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="ID Employé"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm font-mono"
                    required
                  />
                </div>

                {/* Email */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={18} className="text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Adresse email"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
                    required
                  />
                </div>

                {/* Téléphone */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <div className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-slate-400 text-[10px] font-mono group-focus-within:text-cyan-400 group-focus-within:bg-cyan-500/10 transition-colors">Tel</div>
                  </div>
                  <input
                    type="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="Numéro de téléphone"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm font-mono"
                    required
                  />
                </div>

                {/* Mot de passe */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className="text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
                  </div>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Mot de passe"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
                    required
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-2.5 text-sm font-bold uppercase tracking-wide text-white rounded-lg shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''} ${mode === 'login'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-900/20'
                  : 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 shadow-cyan-900/20'
                  }`}
              >
                {isLoading && <Loader size={16} className="animate-spin" />}
                {mode === 'login' ? 'Se connecter' : "Créer un compte"}
              </button>
              <p className="text-center text-[10px] text-slate-600 mt-3">
                En continuant, vous acceptez les conditions d'utilisation de Taxi Coop Terrebonne.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
