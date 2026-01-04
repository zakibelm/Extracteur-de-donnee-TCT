import { useState, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../components/SettingsView';

const SETTINGS_STORAGE_KEY = 'edt_settings';

export const useSettings = () => {
    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
            return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
        } catch (e) {
            return DEFAULT_SETTINGS;
        }
    });

    useEffect(() => {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }, [settings]);

    return {
        settings,
        updateSettings: setSettings
    };
};
