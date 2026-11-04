import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { reportClientError } from './auth';
import '@fontsource-variable/plus-jakarta-sans';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// galat tak terduga di browser dicatat ke log server (membantu memperbaiki bug yang dialami pemain)
addEventListener('error', (e) => reportClientError(String(e.message ?? e), e.error?.stack));
addEventListener('unhandledrejection', (e) => reportClientError(String(e.reason?.message ?? e.reason), e.reason?.stack));

// PWA: cache aset supaya main lokal tetap jalan offline (hanya di build produksi)
if (import.meta.env.PROD && import.meta.env.VITE_OFFLINE !== '1' && import.meta.env.VITE_APP !== '1' && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
