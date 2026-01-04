import { User, ExtractedData, Status } from '../types';

const API_BASE = '/api';

export const api = {
    async loginUser(numDome: string, idEmploye: string, telephone?: string, isAdmin: boolean = false): Promise<User> {
        try {
            const response = await fetch(`${API_BASE}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numDome, idEmploye, telephone, isAdmin })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('API Error Response:', errorData);
                throw new Error(`Login failed (${response.status}): ${errorData.error || errorData.message || 'Unknown error'}`);
            }

            const data = await response.json();
            console.log('Login successful:', data);
            return data;
        } catch (error: any) {
            console.error('Login request failed:', error);
            throw error;
        }
    },

    async fetchExtractions(userId: string, section?: string): Promise<ExtractedData[]> {
        let url = `${API_BASE}/extractions?userDome=${userId}`;
        if (section) url += `&section=${section}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch extractions');
        return response.json();
    },

    async saveExtraction(data: ExtractedData, userId: string, section: string): Promise<ExtractedData> {
        const payload = {
            userId,
            section,
            fileName: data.fileName,
            status: data.status,
            content: data.content
        };

        const response = await fetch(`${API_BASE}/extractions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to save extraction');
        return response.json();
    },

    async deleteExtraction(id: string): Promise<void> {
        const response = await fetch(`${API_BASE}/extractions/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete extraction');
    }
};
