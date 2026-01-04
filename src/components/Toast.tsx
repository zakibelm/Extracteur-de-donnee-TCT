import React from 'react';
import { Toaster } from 'react-hot-toast';

/**
 * Toast Notification System using react-hot-toast
 * Provides user feedback for actions (success, error, info, loading)
 */

export const ToastContainer: React.FC = () => {
    return (
        <Toaster
            position="top-right"
            reverseOrder={false}
            gutter={8}
            toastOptions={{
                // Default options
                duration: 4000,
                style: {
                    background: '#1e293b', // slate-800
                    color: '#f8fafc', // slate-50
                    border: '1px solid #475569', // slate-600
                    borderRadius: '0.75rem',
                    padding: '12px 16px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)',
                    backdropFilter: 'blur(8px)',
                },
                // Success
                success: {
                    duration: 3000,
                    style: {
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        color: '#ffffff',
                        border: '1px solid #34d399',
                    },
                    iconTheme: {
                        primary: '#ffffff',
                        secondary: '#059669',
                    },
                },
                // Error
                error: {
                    duration: 5000,
                    style: {
                        background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                        color: '#ffffff',
                        border: '1px solid #f87171',
                    },
                    iconTheme: {
                        primary: '#ffffff',
                        secondary: '#dc2626',
                    },
                },
                // Loading
                loading: {
                    style: {
                        background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
                        color: '#ffffff',
                        border: '1px solid #38bdf8',
                    },
                },
            }}
        />
    );
};

// Helper functions for easy toast usage
export { toast } from 'react-hot-toast';

/**
 * Custom toast helpers
 */
export const showToast = {
    success: (message: string) => {
        const { toast } = require('react-hot-toast');
        toast.success(message);
    },
    error: (message: string) => {
        const { toast } = require('react-hot-toast');
        toast.error(message);
    },
    loading: (message: string) => {
        const { toast } = require('react-hot-toast');
        return toast.loading(message);
    },
    promise: async <T,>(
        promise: Promise<T>,
        messages: {
            loading: string;
            success: string;
            error: string;
        }
    ) => {
        const { toast } = require('react-hot-toast');
        return toast.promise(promise, messages);
    },
};
