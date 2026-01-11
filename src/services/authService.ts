import { User } from '../types';

interface AuthResponse {
    user?: User;
    error?: string;
    message?: string;
}

export const authService = {
    async login(numDome: string, idEmploye: string): Promise<User> {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', numDome, idEmploye })
        });

        const data: AuthResponse = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erreur de connexion');
        }

        if (!data.user) {
            throw new Error('Données utilisateur invalides');
        }

        return data.user;
    },

    async signup(numDome: string, idEmploye: string, accountType: 'admin' | 'driver', telephone?: string): Promise<User> {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'signup',
                numDome,
                idEmploye,
                accountType,
                telephone
            })
        });

        const data: AuthResponse = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erreur d'inscription");
        }

        // Usually signup returns the user, or requires immediate login. 
        // Our API returns { user: ... }
        if (!data.user) {
            throw new Error('Données utilisateur invalides après inscription');
        }

        return {
            ...data.user,
            telephone // Add back persistent fields if needed that aren't in DB response yet
        };
    }
};
