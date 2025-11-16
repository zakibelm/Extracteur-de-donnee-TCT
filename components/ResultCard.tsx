
import React, { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ExtractedData, Status } from '../types';
import { Icons } from './Icons';

interface ResultCardProps {
  data: ExtractedData;
}

export const ResultCard: React.FC<ResultCardProps> = ({ data }) => {
  const { fileName, imageSrc, content, status } = data;
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
        const { left, top, width, height } = card.getBoundingClientRect();
        const x = e.clientX - left;
        const y = e.clientY - top;
        const rotateX = gsap.utils.mapRange(0, height, -8, 8, y);
        const rotateY = gsap.utils.mapRange(0, width, 8, -8, x);
        gsap.to(card, {
            rotationX: rotateX,
            rotationY: rotateY,
            duration: 0.7,
            ease: 'power3.out'
        });
    };
    
    const onEnter = () => gsap.to(card, { 
        scale: 1.05, 
        y: -5, 
        boxShadow: "0px 15px 25px -5px oklch(from var(--color-primary) l c h / 0.4)",
        duration: 0.3, 
        ease: 'power2.out' 
    });

    const onLeave = () => gsap.to(card, { 
        scale: 1, 
        y: 0,
        rotationX: 0,
        rotationY: 0,
        boxShadow: "0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 1px 2px -1px hsl(0 0% 0% / 0.17)",
        duration: 0.5, 
        ease: 'power3.out' 
    });

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mouseleave', onLeave);

    return () => {
        card.removeEventListener('mousemove', handleMouseMove);
        card.removeEventListener('mouseenter', onEnter);
        card.removeEventListener('mouseleave', onLeave);
        gsap.killTweensOf(card);
    };
  }, []);


  const getStatusIndicator = () => {
    switch (status) {
      case Status.AiProcessing:
         return (
          <div className="flex items-center text-[--color-accent]">
            <Icons.Sparkles className="w-4 h-4 mr-2 animate-pulse" />
            <span>IA...</span>
          </div>
        );
      case Status.Processing: // Fallback
        return (
          <div className="flex items-center text-[--color-accent]">
            <Icons.Loader className="w-4 h-4 mr-2 animate-spin" />
            <span>Traitement...</span>
          </div>
        );
      case Status.Success:
        return (
          <div className="flex items-center text-[--color-chart-2]">
            <Icons.CheckCircle className="w-4 h-4 mr-2" />
            <span>Succès</span>
          </div>
        );
      case Status.Error:
        return (
          <div className="flex items-center text-[--color-destructive]">
            <Icons.XCircle className="w-4 h-4 mr-2" />
            <span>Erreur</span>
          </div>
        );
      default:
        return null;
    }
  };

  const renderContent = () => {
    if (status === Status.AiProcessing || status === Status.Processing) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-[--color-muted-foreground]">
             {status === Status.AiProcessing && "Analyse par l'IA..."}
             {status === Status.Processing && "Traitement en cours..."}
          </div>
        </div>
      );
    }
    if (!content) {
      return "Aucun contenu n'a été extrait.";
    }
    if (typeof content === 'string') {
       // Also check for empty string
      return content.trim() ? content : "Aucun contenu textuel trouvé.";
    }
    // It's a table
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-[--color-card]">
            <tr className="text-[--color-card-foreground]">
              {content.headers.map((header, index) => (
                <th key={index} className="p-1.5 font-semibold border-b border-[--color-border]">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-[--color-border] even:bg-[--color-muted] hover:bg-[--color-muted]">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="p-1.5 text-[--color-card-foreground]">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  return (
    <div ref={cardRef} className="result-card bg-[--color-card] border border-[--color-border] rounded-lg shadow-md overflow-hidden flex flex-col h-full invisible" style={{transformStyle: 'preserve-3d', transform: 'translateY(30px)'}}>
      <div className="relative h-40 overflow-hidden" style={{transform: 'translateZ(20px)'}}>
        <img src={imageSrc} alt={fileName} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>
      <div className="p-4 flex flex-col flex-grow" style={{transform: 'translateZ(10px)'}}>
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-[--color-card-foreground] break-all pr-2">{fileName}</h3>
          <div className="text-xs font-medium flex-shrink-0">{getStatusIndicator()}</div>
        </div>
        <div className="mt-2 bg-[--color-background] rounded-md text-sm flex-grow h-48 overflow-y-auto whitespace-pre-wrap font-mono">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};