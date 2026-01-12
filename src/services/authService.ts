import { User } from '../types';

interface AuthResponse {
    user?: any;
    error?: string;
    message?: string;
}

export const authService = {
    async login(employeeId: string, password: string): Promise<User> {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', employeeId, password })
        });

        const data: AuthResponse = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erreur de connexion');
        }

        if (!data.user) {
            throw new Error('Données utilisateur invalides');
        }

        return {
            id: data.user.id,
            numDome: data.user.num_dome || '',
            idEmploye: data.user.id_employe || '',
            email: data.user.email,
            telephone: data.user.telephone,
            role: data.user.role,
            isAdmin: data.user.role === 'admin'
        };
    },

    async signup(numDome: string, employeeId: string, email: string, password: string, accountType: 'admin' | 'driver', telephone: string): Promise<User> {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'signup',
                numDome,
                employeeId,
                email,
                password,
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

        // Since the API might return mixed casing depending on how strict we are, 
        // let's ensure we map the response from the DB (if data.user has snake_case keys) 
        // or adhere to the input values if data.user is sparse.

        return {
            id: data.user.id,
            numDome: data.user.num_dome || numDome,
            idEmploye: data.user.id_employe || employeeId,
            email: data.user.email || email,
            telephone: data.user.telephone || telephone,
            role: data.user.role,
            isAdmin: data.user.role === 'admin'
        };
    }
};
