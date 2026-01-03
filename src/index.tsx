import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

console.log("🚀 APP STARTING...");

try {
    const rootElement = document.getElementById('root');
    console.log("Root element found:", rootElement);

    if (!rootElement) {
        console.error("CRITICAL: Root element NOT found");
        throw new Error("Could not find root element to mount to");
    }

    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </React.StrictMode>
    );
} catch (e) {
    console.error("CRITICAL APP ERROR:", e);
    document.body.innerHTML += `<div style="color:red;z-index:9999;position:absolute;top:50px;background:white;padding:20px;border:5px solid red;">JS ERROR: ${e}</div>`;
}
