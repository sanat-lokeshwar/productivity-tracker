// client/src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AuthProvider from './contexts/AuthContext';
import { ToastProvider } from './components/Toast'; // Assuming named export, adjust if default
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import './App.css';

/**
 * LOGIC: We wrap the entire app in ErrorBoundary first to catch rendering crashes.
 * Then AuthProvider so the user session is available everywhere.
 * Then ToastProvider for global notifications.
 */

// 1. Ensure the root element exists in the HTML
const container = document.getElementById('root');
if (!container) {
  const rootDiv = document.createElement('div');
  rootDiv.id = 'root';
  document.body.appendChild(rootDiv);
}

const root = createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);