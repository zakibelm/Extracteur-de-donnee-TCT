import { User, ExtractedData, Status } from '../types';

const API_BASE = '/api';

export const api = {
    async loginUser(numDome: string, idEmploye: string, telephone?: string, isAdmin: boolean = false): Promise<User> {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numDome, idEmploye, telephone, isAdmin })
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }
        return response.json();
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
