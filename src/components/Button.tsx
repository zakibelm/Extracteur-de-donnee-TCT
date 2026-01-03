import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { }

export const Button: React.FC<ButtonProps> = ({ className = '', children, ...props }) => {
    return (
        <button
            className={`flex items-center justify-center px-4 py-2 rounded-lg font-medium text-white transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};
