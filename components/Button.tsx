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
};
