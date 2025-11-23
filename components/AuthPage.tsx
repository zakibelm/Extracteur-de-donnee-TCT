
import React, { useState } from 'react';
import { Button } from './Button';
import { Icons } from './Icons';

export interface User {
  numDome: string;
  idEmploye: string;
  telephone?: string;
}

interface AuthPageProps {
  onLogin: (user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    numDome: '',
    idEmploye: '',
    telephone: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSwitchMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setSuccess(null);
    setFormData({ numDome: '', idEmploye: '', telephone: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation de base
    if (!formData.numDome.trim() || !formData.idEmploye.trim()) {
      setError("Le numéro de dôme et l'ID employé sont requis.");
      return;
    }

    // Récupération des utilisateurs existants (simulation DB)
    const users: User[] = JSON.parse(localStorage.getItem('edt_users') || '[]');

    if (isLogin) {
      // LOGIQUE DE CONNEXION
      const user = users.find(u => 
        u.numDome === formData.numDome && u.idEmploye === formData.idEmploye
      );

      if (user) {
        onLogin(user);
      } else {
        setError("Identifiants incorrects. Vérifiez votre numéro de dôme et ID employé.");
      }

    } else {
      // LOGIQUE D'INSCRIPTION
      if (!formData.telephone?.trim()) {
        setError("Le numéro de téléphone est requis pour l'inscription.");
        return;
      }

      const existingUser = users.find(u => 
        u.numDome === formData.numDome && u.idEmploye === formData.idEmploye
      );

      if (existingUser) {
        setError("Un compte existe déjà avec ces identifiants.");
        return;
      }

      const newUser: User = {
        numDome: formData.numDome,
        idEmploye: formData.idEmploye,
        telephone: formData.telephone
      };

      localStorage.setItem('edt_users', JSON.stringify([...users, newUser]));
      setSuccess("Compte créé avec succès ! Vous pouvez maintenant vous connecter.");
      setTimeout(() => setIsLogin(true), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <span className="text-3xl font-bold text-white">EDT</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isLogin ? 'Bienvenue' : 'Créer un compte'}
          </h2>
          <p className="text-emerald-100 text-sm">
            {isLogin ? 'Connectez-vous pour accéder à vos données' : 'Remplissez le formulaire pour commencer'}
          </p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Numéro de Dôme */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Numéro de Dôme</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icons.User className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="text"
                  name="numDome"
                  value={formData.numDome}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  placeholder="Ex: 123"
                />
              </div>
            </div>

            {/* ID Employé */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">ID Employé</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icons.Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="text"
                  name="idEmploye"
                  value={formData.idEmploye}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  placeholder="Votre identifiant unique"
                />
              </div>
            </div>

            {/* Téléphone (Inscription uniquement) */}
            {!isLogin && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Numéro de téléphone</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icons.Phone className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="tel"
                    name="telephone"
                    value={formData.telephone}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    placeholder="Ex: 06 12 34 56 78"
                  />
                </div>
              </div>
            )}

            {/* Messages d'erreur/succès */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start">
                <Icons.XCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-start">
                <Icons.CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20">
              {isLogin ? 'Se connecter' : "S'inscrire"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}
              <button
                onClick={handleSwitchMode}
                className="ml-2 text-emerald-400 hover:text-emerald-300 font-medium focus:outline-none hover:underline transition-colors"
              >
                {isLogin ? "Créer un compte" : "Se connecter"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
