import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/base.css';
import './styles/layout.css';
import './styles/modal.css';
import './styles/ledger.css';
import './styles/expenses.css';
import './styles/trips.css';
import './styles/trip-detail.css';
import './styles/itinerary.css';
import './styles/settings.css';
import './styles/profile.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
