import React, { useState } from 'react';
import { authService } from '../services/authService';
import type { User } from '../types';

interface AuthFormProps {
    onSuccess: (user: User) => void;
}

type AuthMode = 'login' | 'signup' | 'reset';

export const AuthForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Champs du formulaire
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [numDome, setNumDome] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [telephone, setTelephone] = useState('');
    const [accountType, setAccountType] = useState<'admin' | 'driver'>('driver');

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setNumDome('');
        setEmployeeId('');
        setTelephone('');
        setError('');
        setSuccess('');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const user = await authService.login(email, password);
            setSuccess('Connexion réussie !');
            setTimeout(() => onSuccess(user), 500);
        } catch (err: any) {
            setError(err.message || 'Erreur de connexion');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Validation
        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères');
            setLoading(false);
            return;
        }

        try {
            const user = await authService.signup(
                numDome,
                employeeId,
                email,
                password,
                accountType,
                telephone
            );
            setSuccess('Inscription réussie ! Vérifiez votre email pour confirmer votre compte.');
            setTimeout(() => {
                setMode('login');
                resetForm();
            }, 3000);
        } catch (err: any) {
            setError(err.message || 'Erreur lors de l\'inscription');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const result = await authService.resetPassword(email);
            if (result.success) {
                setSuccess(result.message || 'Email de réinitialisation envoyé');
                setTimeout(() => {
                    setMode('login');
                    resetForm();
                }, 3000);
            } else {
                setError(result.message || 'Erreur lors de l\'envoi de l\'email');
            }
        } catch (err: any) {
            setError(err.message || 'Erreur lors de l\'envoi de l\'email');
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (newMode: AuthMode) => {
        setMode(newMode);
        resetForm();
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
                {/* En-tête */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {mode === 'login' && 'Connexion'}
                        {mode === 'signup' && 'Inscription'}
                        {mode === 'reset' && 'Réinitialiser le mot de passe'}
                    </h1>
                    <p className="text-gray-600">
                        {mode === 'login' && 'Connectez-vous à votre compte'}
                        {mode === 'signup' && 'Créez votre compte'}
                        {mode === 'reset' && 'Recevez un lien par email'}
                    </p>
                </div>

                {/* Messages d'erreur et de succès */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
                        {success}
                    </div>
                )}

                {/* Formulaire de connexion */}
                {mode === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="votre@email.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                Mot de passe
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Connexion...' : 'Se connecter'}
                        </button>

                        <div className="text-center space-y-2 text-sm">
                            <button
                                type="button"
                                onClick={() => switchMode('reset')}
                                className="text-blue-600 hover:text-blue-700 hover:underline"
                            >
                                Mot de passe oublié ?
                            </button>
                            <div>
                                <span className="text-gray-600">Pas encore de compte ? </span>
                                <button
                                    type="button"
                                    onClick={() => switchMode('signup')}
                                    className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                                >
                                    S'inscrire
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                {/* Formulaire d'inscription */}
                {mode === 'signup' && (
                    <form onSubmit={handleSignup} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="numDome" className="block text-sm font-medium text-gray-700 mb-1">
                                    Numéro Dôme
                                </label>
                                <input
                                    id="numDome"
                                    type="text"
                                    value={numDome}
                                    onChange={(e) => setNumDome(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="1234"
                                />
                            </div>

                            <div>
                                <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 mb-1">
                                    ID Employé
                                </label>
                                <input
                                    id="employeeId"
                                    type="text"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="EMP001"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                id="signup-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="votre@email.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-1">
                                Téléphone
                            </label>
                            <input
                                id="telephone"
                                type="tel"
                                value={telephone}
                                onChange={(e) => setTelephone(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="514-123-4567"
                            />
                        </div>

                        <div>
                            <label htmlFor="accountType" className="block text-sm font-medium text-gray-700 mb-1">
                                Type de compte
                            </label>
                            <select
                                id="accountType"
                                value={accountType}
                                onChange={(e) => setAccountType(e.target.value as 'admin' | 'driver')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="driver">Chauffeur</option>
                                <option value="admin">Administrateur</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">
                                Mot de passe (min. 6 caractères)
                            </label>
                            <input
                                id="signup-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="••••••••"
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                Confirmer le mot de passe
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Inscription...' : 'S\'inscrire'}
                        </button>

                        <div className="text-center text-sm">
                            <span className="text-gray-600">Déjà un compte ? </span>
                            <button
                                type="button"
                                onClick={() => switchMode('login')}
                                className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                            >
                                Se connecter
                            </button>
                        </div>
                    </form>
                )}

                {/* Formulaire de réinitialisation de mot de passe */}
                {mode === 'reset' && (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div>
                            <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                id="reset-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="votre@email.com"
                            />
                            <p className="mt-2 text-xs text-gray-500">
                                Vous recevrez un lien pour réinitialiser votre mot de passe
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Envoi...' : 'Envoyer le lien'}
                        </button>

                        <div className="text-center text-sm">
                            <button
                                type="button"
                                onClick={() => switchMode('login')}
                                className="text-blue-600 hover:text-blue-700 hover:underline"
                            >
                                ← Retour à la connexion
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
