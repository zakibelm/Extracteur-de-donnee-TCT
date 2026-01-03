<<<<<<< HEAD
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
=======
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children, className, ...props }) => {
  return (
    <button
      {...props}
      className={`flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-emerald-500 ${className || ''}`}
    >
      {children}
    </button>
  );
>>>>>>> fe66bc4faa9c6a00720bfa753a56815eaab97540
};
