import React, { useState, useRef } from 'react';
import { Icons } from './Icons';
import { User } from '../types';
import { api } from '../services/api';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

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
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline();

    // Intro Animation
    tl.from(cardRef.current, {
      y: 50,
      opacity: 0,
      duration: 1.2,
      ease: "power4.out"
    })
      .from(".auth-title", {
        y: -20,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1
      }, "-=0.8")
      .from(".auth-input", {
        x: -20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out"
      }, "-=0.6");

    // Background Blobs Animation
    gsap.to(".blob", {
      x: "random(-50, 50)",
      y: "random(-50, 50)",
      scale: "random(0.8, 1.2)",
      duration: "random(10, 20)",
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      stagger: {
        amount: 5,
        from: "random"
      }
    });

  }, { scope: containerRef });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!numDome.trim() || !idEmploye.trim()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsLoading(true);

    try {
      // Determine admin status based on mode/dome OR explicit choice
      // Here we use the UI toggle primarily, but fallback to logic if needed
      const isAdmin = accountType === 'admin';

      // Call Backend
      const user = await api.loginUser(numDome.trim(), idEmploye.trim(), telephone.trim() || undefined, isAdmin);

      // Exit Animation
      gsap.to(cardRef.current, {
        scale: 0.95,
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
          onLogin(user);
        }
      });

    } catch (err: any) {
      console.error('Login Error:', err);

      // More detailed error messages
      let errorMessage = "Erreur de connexion. Veuillez vérifier la base de données ou vos identifiants.";

      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        errorMessage = "Impossible de se connecter au serveur. Vérifiez que l'API est démarrée.";
      } else if (err.message.includes('429')) {
        errorMessage = "Trop de tentatives de connexion. Veuillez patienter quelques instants.";
      } else if (err.message.includes('400')) {
        errorMessage = "Données invalides. Vérifiez le numéro de dôme et l'ID employé.";
      } else if (err.message.includes('500')) {
        errorMessage = "Erreur serveur. La base de données Neon pourrait être indisponible.";
      }

      alert(errorMessage);
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    if (mode === newMode) return;

    const direction = newMode === 'signup' ? -20 : 20;

    gsap.to(formRef.current, {
      opacity: 0,
      x: direction,
      duration: 0.3,
      onComplete: () => {
        setMode(newMode);
        gsap.fromTo(formRef.current,
          { opacity: 0, x: -direction },
          { opacity: 1, x: 0, duration: 0.3 }
        );
      }
    });
  };

  return (
    <div ref={containerRef} className="relative min-h-[100dvh] w-full bg-slate-950 flex flex-col overflow-y-auto overflow-x-hidden">
      {/* Scrollable Content Wrapper */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-full">

        {/* Ambient Background Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none fixed">
          <div className="blob absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[100px] mix-blend-screen opacity-50 filter" />
          <div className="blob absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[100px] mix-blend-screen opacity-50 filter" />
        </div>

        <div ref={cardRef} className="w-full max-w-md z-10 relative my-8">
          <div className="glass-panel rounded-2xl p-5 md:p-8 border border-white/10 shadow-2xl relative bg-slate-900/60 backdrop-blur-xl">
            {/* Decorative Top Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-500 opacity-70" />

            {/* Header */}
            <div className="text-center mb-5 md:mb-6">
              <div className="auth-title inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 mb-3 shadow-lg backdrop-blur-md">
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 to-cyan-400">ADT</span>
              </div>
              <h1 className="auth-title text-3xl font-bold text-white mb-2 tracking-tight">
                {mode === 'login' ? 'Bon retour' : 'Rejoignez-nous'}
              </h1>
              <p className="auth-title text-slate-400 text-sm">
                {mode === 'login'
                  ? 'Connectez-vous pour accéder à votre espace'
                  : 'Créez votre compte pour commencer'}
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="auth-input flex p-1 bg-slate-950/50 rounded-xl mb-8 relative border border-white/5">
              <div
                className={`absolute inset-y-1 w-1/2 bg-white/10 rounded-lg shadow-sm transition-all duration-300 ease-out ${mode === 'signup' ? 'translate-x-full' : 'translate-x-0'
                  }`}
              />
              <button
                onClick={() => switchMode('login')}
                className={`flex-1 py-2.5 text-sm font-medium z-10 transition-colors duration-300 ${mode === 'login' ? 'text-white' : 'text-slate-400 hover:text-slate-300'
                  }`}
              >
                Connexion
              </button>
              <button
                onClick={() => switchMode('signup')}
                className={`flex-1 py-2.5 text-sm font-medium z-10 transition-colors duration-300 ${mode === 'signup' ? 'text-white' : 'text-slate-400 hover:text-slate-300'
                  }`}
              >
                Inscription
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
              {/* Account Type Selection */}
              <div className="auth-input grid grid-cols-2 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setAccountType('admin')}
                  className={`relative p-3 rounded-xl border transition-all duration-300 group ${accountType === 'admin'
                    ? 'bg-emerald-500/10 border-emerald-500/50'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                    }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Icons.User className={`w-6 h-6 transition-colors ${accountType === 'admin' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300'
                      }`} />
                    <span className={`text-xs font-semibold ${accountType === 'admin' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300'
                      }`}>Répartition</span>
                  </div>
                  {accountType === 'admin' && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType('driver')}
                  className={`relative p-3 rounded-xl border transition-all duration-300 group ${accountType === 'driver'
                    ? 'bg-cyan-500/10 border-cyan-500/50'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                    }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Icons.Truck className={`w-6 h-6 transition-colors ${accountType === 'driver' ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-300'
                      }`} />
                    <span className={`text-xs font-semibold ${accountType === 'driver' ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-300'
                      }`}>Conducteur</span>
                  </div>
                  {accountType === 'driver' && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                  )}
                </button>
              </div>

              <div className="space-y-4">
                <div className="auth-input group">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1 group-focus-within:text-emerald-400 transition-colors">
                    NUMÉRO DE DÔME
                  </label>
                  <div className="relative">
                    <Icons.User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                    <input
                      type="text"
                      value={numDome}
                      onChange={(e) => setNumDome(e.target.value)}
                      className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
                      placeholder="Ex: 123"
                      required
                    />
                  </div>
                </div>

                <div className="auth-input group">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1 group-focus-within:text-emerald-400 transition-colors">
                    ID EMPLOYÉ
                  </label>
                  <div className="relative">
                    <Icons.ScanText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                    <input
                      type="text"
                      value={idEmploye}
                      onChange={(e) => setIdEmploye(e.target.value)}
                      className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
                      placeholder="Identifiant unique"
                      required
                    />
                  </div>
                </div>

                {mode === 'signup' && (
                  <div className="auth-input group">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1 group-focus-within:text-cyan-400 transition-colors">
                      TÉLÉPHONE (OPTIONNEL)
                    </label>
                    <div className="relative">
                      <Icons.UploadCloud className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                      <input
                        type="tel"
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
                        placeholder="514-123-4567"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all duration-200 mt-8 relative group border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? <Icons.Loader className="animate-spin w-5 h-5" /> : (
                    <>
                      {mode === 'login' ? 'Accéder à mon espace' : 'Créer mon compte'}
                      <Icons.ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6 opacity-60">
          &copy; {new Date().getFullYear()} ADT v1.4 (Neon Backend) • Propulsé par Zakibelm
        </p>
      </div>
    </div>
  );
};
