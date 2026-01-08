
import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './Icons';
import { User } from '../types';
import { gsap } from 'gsap';

interface AuthPageProps {
  onLogin: (user: User) => void;
  onDemoAccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin, onDemoAccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<'dispatch' | 'driver'>('dispatch');
  const [domeNumber, setDomeNumber] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  
  const cardRef = useRef<HTMLDivElement>(null);
  const glow1Ref = useRef<HTMLDivElement>(null);
  const glow2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(cardRef.current, 
      { y: 30, opacity: 0, scale: 0.97 }, 
      { y: 0, opacity: 1, scale: 1, duration: 1, ease: "power3.out" }
    );

    gsap.to(glow1Ref.current, {
      x: "random(-80, 80)",
      y: "random(-80, 80)",
      duration: 8,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });
    gsap.to(glow2Ref.current, {
      x: "random(-80, 80)",
      y: "random(-80, 80)",
      duration: 10,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: 0.5
    });
  }, []);

  const handleAccess = (e: React.FormEvent) => {
    e.preventDefault();
    gsap.to(cardRef.current, { scale: 0.98, duration: 0.1, yoyo: true, repeat: 1 });
    onDemoAccess();
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div ref={glow1Ref} className="bg-glow top-[-15%] left-[-15%] scale-75"></div>
      <div ref={glow2Ref} className="bg-glow bottom-[-15%] right-[-15%] scale-75"></div>
      
      <div className="w-full max-w-[390px] relative z-10" ref={cardRef}>
        <div className="bg-zinc-900/70 backdrop-blur-2xl rounded-[1.8rem] border border-zinc-800/60 shadow-[0_0_60px_-15px_rgba(225,29,72,0.15)] overflow-hidden">
          
          <div className="px-6 py-8 md:px-8 md:py-10">
            <div className="flex flex-col items-center mb-6 md:mb-8">
              <div className="px-3 py-1 bg-zinc-800/90 border border-zinc-700/50 rounded-lg mb-4">
                <span className="text-red-500 font-black text-xs tracking-tighter uppercase">ADT</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white mb-1 tracking-tight">Espace Logistique</h1>
              <p className="text-zinc-500 text-[10px] md:text-[11px] text-center uppercase tracking-widest font-bold opacity-60">Identification requise</p>
            </div>

            <div className="flex bg-black/40 p-1 rounded-xl mb-6 border border-zinc-800/40">
              <button 
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'login' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                Connexion
              </button>
              <button 
                onClick={() => setActiveTab('signup')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'signup' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                Inscription
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button 
                onClick={() => setRole('dispatch')}
                className={`relative flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all duration-300 group ${role === 'dispatch' ? 'bg-red-600/5 border-red-500/40 shadow-[inset_0_0_15px_rgba(225,29,72,0.05)]' : 'bg-zinc-900/30 border-transparent hover:bg-zinc-800/40'}`}
              >
                {role === 'dispatch' && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]"></span>}
                <Icons.User className={`w-5 h-5 mb-1.5 transition-transform duration-300 group-hover:scale-105 ${role === 'dispatch' ? 'text-red-500' : 'text-zinc-700'}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${role === 'dispatch' ? 'text-white' : 'text-zinc-600'}`}>Répartition</span>
              </button>
              
              <button 
                onClick={() => setRole('driver')}
                className={`relative flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all duration-300 group ${role === 'driver' ? 'bg-red-600/5 border-red-500/40 shadow-[inset_0_0_15px_rgba(225,29,72,0.05)]' : 'bg-zinc-900/30 border-transparent hover:bg-zinc-800/40'}`}
              >
                {role === 'driver' && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]"></span>}
                <Icons.Truck className={`w-5 h-5 mb-1.5 transition-transform duration-300 group-hover:scale-105 ${role === 'driver' ? 'text-red-500' : 'text-zinc-700'}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${role === 'driver' ? 'text-white' : 'text-zinc-600'}`}>Conducteur</span>
              </button>
            </div>

            <form onSubmit={handleAccess} className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-1 mb-1.5 block">N° Dôme</label>
                <div className="relative group">
                  <Icons.User className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-700 group-focus-within:text-red-500 transition-colors" />
                  <input 
                    type="text" 
                    value={domeNumber}
                    onChange={(e) => setDomeNumber(e.target.value)}
                    placeholder="Ex: 123"
                    className="w-full bg-black/30 border border-zinc-800/80 rounded-xl pl-11 pr-4 py-3 text-xs text-white focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/10 transition-all placeholder:text-zinc-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-1 mb-1.5 block">Code Employé</label>
                <div className="relative group">
                  <Icons.ScanText className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-700 group-focus-within:text-red-500 transition-colors" />
                  <input 
                    type="password" 
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/30 border border-zinc-800/80 rounded-xl pl-11 pr-4 py-3 text-xs text-white focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/10 transition-all placeholder:text-zinc-800"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button 
                  type="submit"
                  className="w-full py-4 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.25em] shadow-[0_10px_20px_-5px_rgba(225,29,72,0.3)] transition-all duration-300 flex items-center justify-center gap-2 group active:scale-[0.98]"
                >
                  Valider
                  <Icons.ChevronRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
                
                <button 
                  type="button"
                  onClick={onDemoAccess}
                  className="w-full py-3.5 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-200 active:scale-[0.99]"
                >
                  Accès Démo Rapide
                </button>
              </div>
            </form>
          </div>

          <div className="py-4 px-8 bg-black/50 border-t border-zinc-800/50 text-center">
            <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-[0.15em] leading-relaxed">
              ADT v1.5 • Neon Backend • 2025
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
