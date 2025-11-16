
import React, { useRef } from 'react';
import { gsap } from 'gsap';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children, className, ...props }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (buttonRef.current) {
        const button = buttonRef.current;
        const rect = button.getBoundingClientRect();
        
        // Create ripple element
        const ripple = document.createElement('span');
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;
        
        ripple.style.width = ripple.style.height = `${diameter}px`;
        ripple.style.left = `${e.clientX - rect.left - radius}px`;
        ripple.style.top = `${e.clientY - rect.top - radius}px`;
        ripple.classList.add('button-ripple');

        // Check if a ripple already exists and remove it
        const oldRipple = button.querySelector('.button-ripple');
        if (oldRipple) {
            oldRipple.remove();
        }

        button.appendChild(ripple);
        
        // Animate with GSAP
        gsap.fromTo(ripple, 
            { scale: 0, opacity: 0.7 },
            { 
                scale: 4, 
                opacity: 0, 
                duration: 0.6, 
                ease: 'power3.out',
                onComplete: () => ripple.remove() 
            }
        );
    }
    
    // Call original onClick if it exists
    if (props.onClick) {
      props.onClick(e);
    }
  };

  return (
    <button
      ref={buttonRef}
      {...props}
      onClick={handleClick}
      className={`relative overflow-hidden flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--color-background] focus:ring-[--color-ring] ${className || ''}`}
    >
      {children}
    </button>
  );
};