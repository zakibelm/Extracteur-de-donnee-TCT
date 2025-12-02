
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Icons } from './Icons';
import { Modal } from './Modal';
import { fetchUsers, createUser, getAirtableConfig, saveAirtableConfig } from '../services/airtable';

export interface User {
  numDome: string;
  idEmploye: string;
  telephone?: string;
  email?: string;
}

interface AuthPageProps {
  onLogin: (user: User) => void;
}

type UserRole = 'admin' | 'driver';

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [formData, setFormData] = useState({
    numDome: '',
    idEmploye: '',
    telephone: '',
    email: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Config Modal State
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configData, setConfigData] = useState({ apiKey: '', baseId: '' });

  useEffect(() => {
    const savedConfig = getAirtableConfig();
    if (savedConfig) {
        setConfigData(savedConfig);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSwitchMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setSuccess(null);
    setFormData({ numDome: '', idEmploye: '', telephone: '', email: '' });
  };

  const handleSaveConfig = () => {
      saveAirtableConfig(configData);
      setIsConfigOpen(false);
      setSuccess("Configuration Cloud sauvegardée.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    if (!formData.numDome.trim() || !formData.idEmploye.trim()) {
      setError("Le numéro de dôme et l'ID employé sont requis.");
      setIsLoading(false);
      return;
    }

    try {
        const users = await fetchUsers();

        if (isLogin) {
            const user = users.find(u => 
                String(u.numDome) === String(formData.numDome) && 
                String(u.idEmploye) === String(formData.idEmploye)
            );

            if (user) {
                onLogin(user);
            } else {
                setError("Identifiants incorrects ou compte inexistant.");
            }
        } else {
            // Inscription
            if (!formData.telephone?.trim()) {
                setError("Le numéro de téléphone est requis pour l'inscription.");
                setIsLoading(false);
                return;
            }
            if (!formData.email?.trim()) {
                setError("L'email est requis pour l'inscription.");
                setIsLoading(false);
                return;
            }

            const existingUser = users.find(u => 
                String(u.numDome) === String(formData.numDome) && 
                String(u.idEmploye) === String(formData.idEmploye)
            );

            if (existingUser) {
                setError("Un compte existe déjà avec ces identifiants.");
                setIsLoading(false);
                return;
            }

            const newUser: User = {
                numDome: formData.numDome,
                idEmploye: formData.idEmploye,
                telephone: formData.telephone,
                email: formData.email
            };

            await createUser(newUser);
            setSuccess("Compte créé avec succès dans le Cloud ! Connexion...");
            setTimeout(() => {
                onLogin(newUser);
            }, 1000);
        }
    } catch (err: any) {
        setError("Erreur de connexion au serveur : " + err.message);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans relative">
      
      {/* Bouton de Configuration Cloud (Discret) */}
      <button 
        onClick={() => setIsConfigOpen(true)}
        className="absolute top-4 right-4 p-2 text-slate-500 hover:text-emerald-400 transition-colors"
        title="Configuration Cloud"
      >
          <Icons.Settings className="w-6 h-6" />
      </button>

      <Modal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} title="Configuration Airtable (Admin)">
            <div className="space-y-4 p-2">
                <p className="text-sm text-slate-400">
                    Connectez l'application à votre base de données Airtable pour synchroniser les utilisateurs et les tournées.
                </p>
                <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Personal Access Token (Clé API)</label>
                    <input 
                        type="password" 
                        value={configData.apiKey}
                        onChange={(e) => setConfigData({...configData, apiKey: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 text-sm"
                        placeholder="pat..."
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Base ID</label>
                    <input 
                        type="text" 
                        value={configData.baseId}
                        onChange={(e) => setConfigData({...configData, baseId: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 text-sm"
                        placeholder="app..."
                    />
                </div>
                <div className="pt-4 flex justify-end">
                    <Button onClick={handleSaveConfig} className="bg-emerald-600 hover:bg-emerald-700">
                        Enregistrer
                    </Button>
                </div>
            </div>
      </Modal>

      <div className="max-w-md w-full">
        {/* Titre externe ou intégré - Ici intégré au dessus du form comme demandé */}
        
        <div className="bg-slate-800 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
          <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 p-6 text-center">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
              <span className="text-2xl font-bold text-white">ADT</span>
            </div>
            <h2 className="text-xl font-bold text-white">
              {isLogin ? 'Bienvenue' : 'Créer un compte'}
            </h2>
          </div>

          <div className="p-6">
            
            {/* SÉLECTION DU RÔLE */}
            <div className="mb-6">
                <h3 className="text-slate-200 font-semibold mb-3">Type de Compte</h3>
                <div className="grid grid-cols-2 gap-4">
                    {/* Carte Administrateur */}
                    <button
                        type="button"
                        onClick={() => setSelectedRole('admin')}
                        className={`relative p-4 rounded-lg border-2 flex flex-col items-center justify-center text-center transition-all duration-200 ${
                            selectedRole === 'admin'
                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/10'
                                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                        }`}
                    >
                        {selectedRole === 'admin' && (
                            <div className="absolute top-2 right-2">
                                <Icons.CheckCircle className="w-4 h-4 text-emerald-500" />
                            </div>
                        )}
                        <Icons.UserCog className={`w-8 h-8 mb-2 ${selectedRole === 'admin' ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <span className="font-bold text-sm">Administrateur</span>
                        <span className="text-[10px] mt-1 opacity-80 leading-tight">Accès complet au système</span>
                    </button>

                    {/* Carte Conducteur */}
                    <button
                        type="button"
                        onClick={() => setSelectedRole('driver')}
                        className={`relative p-4 rounded-lg border-2 flex flex-col items-center justify-center text-center transition-all duration-200 ${
                            selectedRole === 'driver'
                                ? 'border-sky-500 bg-sky-500/10 text-sky-400 shadow-lg shadow-sky-500/10'
                                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                        }`}
                    >
                         {selectedRole === 'driver' && (
                            <div className="absolute top-2 right-2">
                                <Icons.CheckCircle className="w-4 h-4 text-sky-500" />
                            </div>
                        )}
                        <Icons.User className={`w-8 h-8 mb-2 ${selectedRole === 'driver' ? 'text-sky-400' : 'text-slate-500'}`} />
                        <span className="font-bold text-sm">Conducteur</span>
                         <span className="text-[10px] mt-1 opacity-80 leading-tight">Accès aux routes assignées</span>
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Numéro de Dôme</label>
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

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">ID Employé</label>
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

              {!isLogin && (
                <>
                  <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Email</label>
                      <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Icons.Mail className="h-5 w-5 text-slate-500" />
                      </div>
                      <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                          placeholder="Ex: chauffeur@exemple.com"
                      />
                      </div>
                  </div>

                  <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Numéro de téléphone</label>
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
                </>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start">
                  <Icons.XCircle className="w-5 h-5 mr-2 flex-shrink-0