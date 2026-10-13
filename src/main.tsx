/*
 * Based on the Siemens iX React starter (MIT, Copyright (c) Siemens 2018 - 2026).
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';

import '@siemens/ix/dist/siemens-ix/siemens-ix.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
