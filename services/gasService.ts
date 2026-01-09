
import { SheetRow } from '../types';

/**
 * CONFIGURATION SUPER ADMIN - PROJET : adt-482910
 */
const PRODUCTION_CLIENT_ID = '255440296712-jiilma415bf161bri366u0nd2el7fs7r.apps.googleusercontent.com';
const PRODUCTION_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkMWiwrV3Zl3X04wSpPX5Nf-PjAhynC-aO3M38f0ukwkHcPvmzYKhHNKV6lNM-Z5w/exec';

interface GoogleConfig {
    googleClientId: string;
    appsScriptUrl: string;
}

export const getGoogleConfig = (): GoogleConfig => {
    return {
        googleClientId: process.env.GOOGLE_CLIENT_ID || PRODUCTION_CLIENT_ID,
        appsScriptUrl: process.env.APPS_SCRIPT_URL || PRODUCTION_SCRIPT_URL
    };
};

export const gasService = {
  async fetchUserData(email: string): Promise<SheetRow[]> {
    const config = getGoogleConfig();
    if (!config.appsScriptUrl) return [];
    
    try {
        console.log(`Tentative de lecture GAS pour: ${email}`);
        const response = await fetch(`${config.appsScriptUrl}?email=${encodeURIComponent(email)}`, {
            method: 'GET',
            mode: 'cors',
            redirect: 'follow'
        });

        if (!response.ok) {
            console.error("GAS Response Not OK:", response.status);
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log("Données reçues de GAS:", data.length, "lignes");
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.error("Détails de l'échec fetchUserData:", err);
        throw err;
    }
  },

  async saveExtraction(email: string, imageId: string, extractedData: any): Promise<void> {
    const config = getGoogleConfig();
    try {
        await fetch(config.appsScriptUrl, {
          method: "POST",
          mode: "no-cors",
          cache: "no-cache",
          body: JSON.stringify({
            action: "save",
            user_email: email,
            image_id: imageId,
            extracted_data: extractedData
          })
        });
        console.log("Demande de sauvegarde envoyée à GAS");
    } catch (err) {
        console.error("Erreur envoi saveExtraction:", err);
    }
  },

  async updateRow(email: string, imageId: string, field: 'status' | 'notes', value: string): Promise<void> {
    const config = getGoogleConfig();
    await fetch(config.appsScriptUrl, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        action: "update",
        user_email: email,
        image_id: imageId,
        field,
        value
      })
    });
  },

  async sendChangeRequest(data: any): Promise<void> {
    const config = getGoogleConfig();
    await fetch(config.appsScriptUrl, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        action: "change_request",
        ...data
      })
    });
  }
};
