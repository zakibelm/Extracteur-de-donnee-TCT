import React from 'react';
import { Icons } from './Icons';
import { useTheme } from '../theme/ThemeContext';

export const Footer: React.FC = () => {
    const { theme } = useTheme();
    const currentYear = new Date().getFullYear();

    return (
        <footer className="relative w-full border-t border-slate-700/50 bg-gradient-to-b from-slate-900/50 to-slate-950/80 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Main Footer Content */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Brand Section */}
                    <div className="flex flex-col items-center md:items-start space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-sky-500/30">
                                <Icons.Truck className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">ADT Extracteur</h3>
                                <p className="text-xs text-slate-400">Données Tabulaires</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400 text-center md:text-left max-w-xs">
                            Solution professionnelle d'extraction de données avec intelligence artificielle
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div className="flex flex-col items-center space-y-2">
                        <h4 className="text-sm font-semibold text-slate-300 mb-1">Liens Rapides</h4>
                        <a href="#" className="text-sm text-slate-400 hover:text-sky-400 transition-colors">
                            Documentation
                        </a>
                        <a href="#" className="text-sm text-slate-400 hover:text-sky-400 transition-colors">
                            Support
                        </a>
                        <a href="#" className="text-sm text-slate-400 hover:text-sky-400 transition-colors">
                            Confidentialité
                        </a>
                    </div>

                    {/* Tech Stack */}
                    <div className="flex flex-col items-center md:items-end space-y-2">
                        <h4 className="text-sm font-semibold text-slate-300 mb-1">Technologies</h4>
                        <div className="flex flex-wrap gap-2 justify-center md:justify-end">
                            <span className="px-2 py-1 text-xs bg-slate-800/50 text-sky-400 rounded-md border border-slate-700/50">
                                React 19
                            </span>
                            <span className="px-2 py-1 text-xs bg-slate-800/50 text-emerald-400 rounded-md border border-slate-700/50">
                                TypeScript
                            </span>
                            <span className="px-2 py-1 text-xs bg-slate-800/50 text-purple-400 rounded-md border border-slate-700/50">
                                Tailwind CSS
                            </span>
                            <span className="px-2 py-1 text-xs bg-slate-800/50 text-amber-400 rounded-md border border-slate-700/50">
                                Vercel
                            </span>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-700/50 pt-6">
                    <div className="flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0">
                        {/* Copyright */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-400">
                                © {currentYear} ADT Extracteur
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="text-sm text-slate-400">
                                Tous droits réservés
                            </span>
                        </div>

                        {/* Powered By */}
                        <div className="flex items-center gap-2 group">
                            <span className="text-sm text-slate-500">Propulsé par</span>
                            <a
                                href="https://github.com/zakibelm"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-lg font-semibold text-sm shadow-lg shadow-sky-500/30 hover:shadow-sky-500/50 transition-all duration-300 hover:scale-105 active:scale-95"
                            >
                                <Icons.Sparkles className="w-4 h-4" />
                                <span>Zakibelm</span>
                                <span className="text-xs opacity-80">© {currentYear}</span>
                            </a>
                        </div>

                        {/* Version */}
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="px-2 py-1 bg-slate-800/50 rounded border border-slate-700/50">
                                v2.0.0
                            </span>
                            <span className="hidden sm:inline">•</span>
                            <span className="hidden sm:inline">Modern Edition</span>
                        </div>
                    </div>
                </div>

                {/* Status Indicator (Optional) */}
                <div className="mt-4 flex justify-center">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span>Tous les systèmes opérationnels</span>
                    </div>
                </div>
            </div>

            {/* Decorative gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent"></div>
        </footer>
    );
};
