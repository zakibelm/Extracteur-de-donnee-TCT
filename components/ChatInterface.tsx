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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [history, isLoading]);

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
        <div className="flex flex-col h-full max-w-4xl mx-auto bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="p-4 border-b border-slate-700">
                <label className="block text-sm font-medium text-slate-300 mb-2">Choisir un rôle pour l'IA :</label>
                <div className="flex flex-wrap gap-2">
                    {AGENT_ROLES.map(role => (
                        <button
                            key={role.id}
                            onClick={() => setSelectedRole(role.id)}
                            title={role.description}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 border
                                ${selectedRole === role.id 
                                    ? 'bg-sky-500 border-sky-400 text-white shadow-md' 
                                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
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
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                                    <Icons.Sparkles className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <div className={`p-4 rounded-lg ${chat.role === 'user'
                                ? 'bg-emerald-600 text-white rounded-br-none max-w-lg'
                                : 'bg-slate-700 text-slate-200 rounded-bl-none max-w-2xl'
                                }`}>
                                <div className="chat-content text-sm">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{chat.text}</ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-4">
                             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                                <Icons.Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div className="p-4 rounded-lg bg-slate-700 text-slate-200 rounded-bl-none">
                                <div className="flex items-center space-x-2">
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-75"></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-150"></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-300"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            <div className="p-4 border-t border-slate-700">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <textarea
                        value={message}
                        onChange={handleTextChange}
                        onKeyPress={handleKeyPress}
                        placeholder="Posez une question sur les données extraites..."
                        rows={1}
                        className="flex-1 bg-slate-700 text-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                        disabled={isLoading}
                    />
                     <button
                        type="button"
                        onClick={handleToggleListening}
                        title={speechSupport.supported ? "Commande vocale" : speechSupport.reason}
                        disabled={isLoading || !speechSupport.supported}
                        className={`p-2 rounded-full text-white transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed ${
                            isListening 
                            ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                            : 'bg-sky-600 hover:bg-sky-700'
                        }`}
                    >
                        <Icons.Microphone className="w-5 h-5" />
                    </button>
                    <button
                        type="submit"
                        disabled={!message.trim() || isLoading}
                        className="p-2 bg-emerald-600 rounded-full text-white hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                        <Icons.Send className="w-5 h-5" />
                    </button>
                </form>
                {speechError && (
                    <p className="text-xs text-red-400 mt-2 text-center">{speechError}</p>
                )}
            </div>
        </div>
    );
};