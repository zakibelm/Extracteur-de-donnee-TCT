

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, AGENT_ROLES } from '../types';
import { Icons } from './Icons';

// Add SpeechRecognition to window type for TypeScript
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

interface ChatInterfaceProps {
    history: ChatMessage[];
    isLoading: boolean;
    onSendMessage: (message: string, role: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ history, isLoading, onSendMessage }) => {
    const [message, setMessage] = useState('');
    const [selectedRole, setSelectedRole] = useState('auto');
    const [isListening, setIsListening] = useState(false);
    const [speechSupport, setSpeechSupport] = useState<{ supported: boolean; reason?: string }>({ supported: false });
    const [speechError, setSpeechError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if(isExpanded) {
            scrollToBottom();
        }
    }, [history, isLoading, isExpanded]);

    // Effect to check for API support on component mount
    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!window.isSecureContext) {
            setSpeechSupport({ supported: false, reason: "La commande vocale nécessite une connexion sécurisée (HTTPS)." });
            console.warn("La reconnaissance vocale n'est disponible que sur les connexions sécurisées (HTTPS).");
            return;
        }

        if (SpeechRecognitionAPI) {
            setSpeechSupport({ supported: true });
        } else {
            setSpeechSupport({ supported: false, reason: "La commande vocale n'est pas supportée par ce navigateur." });
            console.warn("Votre navigateur ne supporte pas l'API Speech Recognition.");
        }
    }, []);

    const handleToggleListening = () => {
        if (isLoading || !speechSupport.supported) return;
        
        setSpeechError(null);

        // If currently listening, stop the recognition
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            return;
        }

        // Start a new recognition session
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) return;

        const recognition = new SpeechRecognitionAPI();
        recognitionRef.current = recognition;
        
        recognition.lang = 'fr-FR';
        recognition.interimResults = false;
        recognition.continuous = false;

        // Sync UI state with actual recognition events
        recognition.onstart = () => {
            setIsListening(true);
        };
        
        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null; // Clean up the ref
        };

        recognition.onerror = (event: any) => {
            console.error("Erreur de reconnaissance vocale:", event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                setSpeechError("L'accès au microphone a été refusé. Veuillez l'autoriser dans les paramètres de votre navigateur.");
                setSpeechSupport({ supported: false, reason: "Accès au microphone refusé." });
            } else if (event.error === 'no-speech') {
                setSpeechError("Aucun son n'a été détecté. Veuillez réessayer.");
            } else {
                setSpeechError(`Une erreur de reconnaissance vocale est survenue: ${event.error}`);
            }
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript.trim();
            setMessage(prevMessage => (prevMessage ? `${prevMessage} ${transcript}` : transcript).trim());
        };
        
        try {
            recognition.start();
        } catch (error) {
             console.error("Impossible de démarrer la reconnaissance vocale:", error);
             setSpeechError("Impossible de démarrer la reconnaissance vocale.");
             // Ensure cleanup if start() fails immediately
             setIsListening(false);
             recognitionRef.current = null;
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && !isLoading) {
            onSendMessage(message, selectedRole);
            setMessage('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        if (speechError) {
            setSpeechError(null);
        }
    };

    return (
        <div className="flex-shrink-0 bg-[--color-card] border-t-2 border-[--color-border] rounded-t-lg mt-4 shadow-2xl">
            <header 
                className="p-3 flex justify-between items-center cursor-pointer hover:bg-[--color-muted] transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-controls="chat-content"
            >
                <div className="flex items-center gap-3">
                    <Icons.MessageCircle className="w-6 h-6 text-[--color-accent]" />
                    <h3 className="font-bold text-[--color-card-foreground]">Discuter avec les Données</h3>
                </div>
                <button className="text-[--color-muted-foreground] hover:text-[--color-foreground]" aria-label={isExpanded ? "Réduire le chat" : "Agrandir le chat"}>
                    {isExpanded ? <Icons.ChevronDown className="w-6 h-6" /> : <Icons.ChevronUp className="w-6 h-6" />}
                </button>
            </header>
            
            <div 
                id="chat-content"
                className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[60vh]' : 'max-h-0'}`}
            >
                <div className="flex flex-col h-[55vh]">
                    <div className="p-4 border-b border-[--color-border]">
                        <label className="block text-sm font-medium text-[--color-card-foreground] mb-2">Choisir un rôle pour l'IA :</label>
                        <div className="flex flex-wrap gap-2">
                            {AGENT_ROLES.map(role => (
                                <button
                                    key={role.id}
                                    onClick={() => setSelectedRole(role.id)}
                                    title={role.description}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 border
                                        ${selectedRole === role.id 
                                            ? 'bg-[--color-secondary] border-[--color-secondary] text-[--color-secondary-foreground] shadow-md' 
                                            : 'bg-[--color-muted] border-[--color-border] text-[--color-muted-foreground] hover:bg-[--color-accent] hover:border-[--color-accent]'
                                        }`}
                                >
                                    {role.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 p-6 overflow-y-auto">
                        <div className="space-y-6">
                            {history.map((chat, index) => (
                                <div key={index} className={`flex items-start gap-4 ${chat.role === 'user' ? 'justify-end' : ''}`}>
                                    {chat.role === 'model' && (
                                        <div className="w-8 h-8 rounded-full bg-[--color-accent] flex items-center justify-center flex-shrink-0">
                                            <Icons.Sparkles className="w-5 h-5 text-white" />
                                        </div>
                                    )}
                                    <div className={`p-4 rounded-lg ${chat.role === 'user'
                                        ? 'bg-[--color-primary] text-[--color-primary-foreground] rounded-br-none max-w-lg'
                                        : 'bg-[--color-muted] text-[--color-muted-foreground] rounded-bl-none max-w-2xl'
                                        }`}>
                                        <div className="chat-content text-sm">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{chat.text}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex items-start gap-4">
                                     <div className="w-8 h-8 rounded-full bg-[--color-accent] flex items-center justify-center flex-shrink-0">
                                        <Icons.Sparkles className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="p-4 rounded-lg bg-[--color-muted] text-[--color-muted-foreground] rounded-bl-none">
                                        <div className="flex items-center space-x-2">
                                            <span className="w-2 h-2 bg-[--color-muted-foreground] rounded-full animate-pulse delay-75"></span>
                                            <span className="w-2 h-2 bg-[--color-muted-foreground] rounded-full animate-pulse delay-150"></span>
                                            <span className="w-2 h-2 bg-[--color-muted-foreground] rounded-full animate-pulse delay-300"></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                </div>
            </div>

            <div className={`p-4 border-t border-[--color-border] ${!isExpanded ? 'rounded-b-lg' : ''}`}>
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <textarea
                        value={message}
                        onChange={handleTextChange}
                        onKeyPress={handleKeyPress}
                        placeholder="Posez une question sur les données extraites..."
                        rows={1}
                        className="flex-1 bg-[--color-input] text-[--color-foreground] rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-[--color-ring] disabled:opacity-50"
                        disabled={isLoading}
                    />
                     <button
                        type="button"
                        onClick={handleToggleListening}
                        title={speechSupport.supported ? "Commande vocale" : speechSupport.reason}
                        disabled={isLoading || !speechSupport.supported}
                        className={`p-2 rounded-full text-white transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed ${
                            isListening 
                            ? 'bg-[--color-destructive] hover:brightness-90 animate-pulse' 
                            : 'bg-[--color-secondary] hover:brightness-90'
                        }`}
                    >
                        <Icons.Microphone className="w-5 h-5" />
                    </button>
                    <button
                        type="submit"
                        disabled={!message.trim() || isLoading}
                        className="p-2 bg-[--color-primary] rounded-full text-[--color-primary-foreground] hover:brightness-90 disabled:bg-[--color-muted] disabled:cursor-not-allowed transition-colors"
                    >
                        <Icons.Send className="w-5 h-5" />
                    </button>
                </form>
                {speechError && (
                    <p className="text-xs text-[--color-destructive] mt-2 text-center">{speechError}</p>
                )}
            </div>
        </div>
    );
};