import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { Icons } from './Icons';

interface ChatInterfaceProps {
    history: ChatMessage[];
    isLoading: boolean;
    onSendMessage: (message: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ history, isLoading, onSendMessage }) => {
    const [message, setMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [history, isLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && !isLoading) {
            onSendMessage(message);
            setMessage('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="space-y-6">
                    {history.map((chat, index) => (
                        <div key={index} className={`flex items-start gap-4 ${chat.role === 'user' ? 'justify-end' : ''}`}>
                            {chat.role === 'model' && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                                    <Icons.Sparkles className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <div className={`p-4 rounded-lg max-w-lg ${chat.role === 'user'
                                ? 'bg-emerald-600 text-white rounded-br-none'
                                : 'bg-slate-700 text-slate-200 rounded-bl-none'
                                }`}>
                                <p className="text-sm whitespace-pre-wrap">{chat.text}</p>
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
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Posez une question sur les données extraites..."
                        rows={1}
                        className="flex-1 bg-slate-700 text-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!message.trim() || isLoading}
                        className="p-2 bg-emerald-600 rounded-full text-white hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                        <Icons.Send className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
    );
};
