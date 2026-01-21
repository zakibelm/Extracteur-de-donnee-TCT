import { supabase } from '../lib/supabaseClient';
import { User } from '../types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface AuthResponse {
    success: boolean;
    user?: User | null;
    message?: string;
}

// Convertir l'utilisateur Supabase en User de l'application
function toAppUser(supabaseUser: SupabaseUser): User {
    return {
        id: supabaseUser.id,
        numDome: supabaseUser.user_metadata?.numDome || supabaseUser.id,
        idEmploye: supabaseUser.user_metadata?.employeeId || '',
        email: supabaseUser.email || '',
        telephone: supabaseUser.user_metadata?.telephone || '',
        role: supabaseUser.user_metadata?.role || 'driver',
        isAdmin: supabaseUser.user_metadata?.role === 'admin'
    };
}

export const authService = {
    // Connexion avec email et mot de passe
    async login(email: string, password: string): Promise<User> {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            if (!data.user) throw new Error('Données utilisateur invalides');

            const user = toAppUser(data.user);
            console.log('[Auth] Connexion réussie:', user.email);
            return user;
        } catch (error: any) {
            console.error('[Auth] Erreur connexion:', error);
            throw new Error(error.message || 'Email ou mot de passe incorrect');
        }
    },

    // Inscription avec email et mot de passe
    async signup(
        numDome: string,
        employeeId: string,
        email: string,
        password: string,
        accountType: 'admin' | 'driver',
        telephone: string
    ): Promise<User> {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        numDome,
                        employeeId,
                        telephone,
                        role: accountType,
                        name: email.split('@')[0]
                    },
                    emailRedirectTo: `${window.location.origin}/auth/callback`
                }
            });

            if (error) throw error;
            if (!data.user) throw new Error('Données utilisateur invalides après inscription');

            const user = toAppUser(data.user);
            console.log('[Auth] Inscription réussie:', user.email);
            return user;
        } catch (error: any) {
            console.error('[Auth] Erreur inscription:', error);
            throw new Error(error.message || 'Erreur lors de l\'inscription');
        }
    },

    // Déconnexion
    async logout(): Promise<void> {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            console.log('[Auth] Déconnexion réussie');
        } catch (error: any) {
            console.error('[Auth] Erreur déconnexion:', error);
            throw new Error(error.message || 'Erreur lors de la déconnexion');
        }
    },

    // Réinitialisation du mot de passe
    async resetPassword(email: string): Promise<AuthResponse> {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset-password`
            });

            if (error) throw error;

            return {
                success: true,
                message: 'Un email de réinitialisation a été envoyé à votre adresse'
            };
        } catch (error: any) {
            console.error('[Auth] Erreur réinitialisation:', error);
            return {
                success: false,
                message: error.message || 'Erreur lors de l\'envoi de l\'email'
            };
        }
    },

    // Mettre à jour le mot de passe
    async updatePassword(newPassword: string): Promise<AuthResponse> {
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            return {
                success: true,
                message: 'Mot de passe mis à jour avec succès'
            };
        } catch (error: any) {
            console.error('[Auth] Erreur mise à jour mot de passe:', error);
            return {
                success: false,
                message: error.message || 'Erreur lors de la mise à jour du mot de passe'
            };
        }
    },

    // Récupérer l'utilisateur actuel
    async getCurrentUser(): Promise<User | null> {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();

            if (error) throw error;
            if (!user) return null;

            return toAppUser(user);
        } catch (error) {
            console.error('[Auth] Erreur récupération utilisateur:', error);
            return null;
        }
    },

    // Écouter les changements d'état d'authentification
    onAuthStateChange(callback: (user: User | null) => void) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const user = session?.user ? toAppUser(session.user) : null;
            callback(user);
        });

        return subscription;
    }
};
