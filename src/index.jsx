// src/index.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { i18nReady } from './i18n';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Seçili dil inmeden çizmeyelim; aksi halde ilk karede ham anahtarlar görünür.
i18nReady.then(() => {
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
});
