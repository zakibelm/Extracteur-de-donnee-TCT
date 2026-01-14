/**
 * ErrorBoundary - Composant pour capturer et gérer les erreurs React
 * Empêche le crash complet de l'application et offre une UI de secours
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Met à jour l'état pour afficher l'UI de secours
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log l'erreur dans la console
    console.error('🔴 ErrorBoundary caught an error:', error, errorInfo);

    // Appelle le callback onError si fourni
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: Envoyer l'erreur à Sentry ou autre service de monitoring
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    // }

    // Met à jour l'état avec les infos d'erreur
    this.setState({
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Si un fallback personnalisé est fourni, l'utiliser
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Sinon, afficher l'UI de secours par défaut
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-8">
            {/* Icône d'erreur */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Message d'erreur */}
            <h1 className="text-3xl font-bold text-white text-center mb-4">
              Oups! Une erreur est survenue
            </h1>

            <p className="text-slate-300 text-center mb-6">
              L'application a rencontré une erreur inattendue. Nos équipes ont été
              notifiées et travaillent sur le problème.
            </p>

            {/* Détails de l'erreur (en dev uniquement) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 bg-slate-900/50 rounded-lg p-4 border border-red-500/30">
                <summary className="cursor-pointer text-red-400 font-semibold mb-2">
                  Détails techniques (dev)
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="text-slate-400 font-mono text-sm">Message:</span>
                    <p className="text-red-300 font-mono text-sm mt-1">
                      {this.state.error.message}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono text-sm">Stack:</span>
                    <pre className="text-red-300 font-mono text-xs mt-1 overflow-x-auto">
                      {this.state.error.stack}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <span className="text-slate-400 font-mono text-sm">
                        Component Stack:
                      </span>
                      <pre className="text-red-300 font-mono text-xs mt-1 overflow-x-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
              >
                Réessayer
              </button>

              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-3 bg-white/10 backdrop-blur text-white rounded-lg font-semibold hover:bg-white/20 transition-all border border-white/20"
              >
                Retour à l'accueil
              </button>
            </div>

            {/* Support */}
            <div className="mt-8 pt-6 border-t border-white/10 text-center">
              <p className="text-slate-400 text-sm">
                Si le problème persiste, contactez le support à{' '}
                <a
                  href="mailto:support@adt.com"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  support@adt.com
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
