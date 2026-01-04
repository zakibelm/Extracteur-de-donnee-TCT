import { useState, useEffect } from 'react';
import { User } from '../types';

const USER_STORAGE_KEY = 'edt_user';

export const useAuth = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        try {
            const saved = localStorage.getItem(USER_STORAGE_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        if (currentUser) {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
        } else {
            localStorage.removeItem(USER_STORAGE_KEY);
        }
    }, [currentUser]);

    const login = (user: User) => {
        setCurrentUser(user);
    };

    const logout = () => {
        setCurrentUser(null);
    };

    return {
        currentUser,
        isAuthenticated: !!currentUser,
        isAdmin: currentUser?.isAdmin ?? false,
        login,
        logout
    };
};
