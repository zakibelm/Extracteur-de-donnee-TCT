import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'glass' | 'interactive';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    variant = 'default',
    padding = 'md',
    onClick,
    ...props
}) => {
    const baseClasses = 'rounded-xl overflow-hidden transition-all duration-200 relative';

    const variantClasses = {
        default: 'bg-slate-800 border border-slate-700 shadow-sm',
        glass: 'glass-panel border border-white/10 shadow-lg backdrop-blur-md bg-slate-900/60',
        interactive: 'bg-slate-800 border border-slate-700 shadow-md hover:shadow-xl hover:-translate-y-0.5 cursor-pointer'
    };

    const paddingClasses = {
        none: '',
        sm: 'p-3',
        md: 'p-4 md:p-6',
        lg: 'p-6 md:p-8'
    };

    const activeVariant = onClick ? 'interactive' : variant;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
        }
        if (props.onKeyDown) {
            props.onKeyDown(e);
        }
    };

    return (
        <div
            className={`${baseClasses} ${variantClasses[activeVariant]} ${paddingClasses[padding]} ${className}`}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? handleKeyDown : undefined}
            aria-label={onClick ? 'Carte interactive' : undefined}
            {...props}
        >
            {children}
        </div>
    );
};
