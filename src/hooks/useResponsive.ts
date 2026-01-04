import { useState, useEffect } from 'react';

type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

export const useResponsive = () => {
    const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        const updateBreakpoint = () => {
            const width = window.innerWidth;
            if (width < 640) {
                setBreakpoint('mobile');
                setIsSidebarOpen(false);
            } else if (width < 1024) {
                setBreakpoint('tablet');
                setIsSidebarOpen(false);
            } else if (width < 1536) {
                setBreakpoint('desktop');
                setIsSidebarOpen(true);
            } else {
                setBreakpoint('wide');
                setIsSidebarOpen(true);
            }
        };

        updateBreakpoint();
        window.addEventListener('resize', updateBreakpoint);
        return () => window.removeEventListener('resize', updateBreakpoint);
    }, []);

    return {
        breakpoint,
        isMobile: breakpoint === 'mobile',
        isTablet: breakpoint === 'tablet',
        isDesktop: breakpoint === 'desktop',
        isWide: breakpoint === 'wide',
        isSidebarOpen,
        setIsSidebarOpen
    };
};
