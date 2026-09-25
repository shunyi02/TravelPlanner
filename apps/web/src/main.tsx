import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initTheme } from './themes';
import '@fontsource-variable/inter';
import './styles/base.css';
import './styles/layout.css';
import './styles/modal.css';
import './styles/ledger.css';
import './styles/balances.css';
import './styles/expenses.css';
import './styles/charts.css';
import './styles/report.css';
import './styles/trips.css';
import './styles/trip-detail.css';
import './styles/itinerary.css';
import './styles/trip-dates.css';
import './styles/discover.css';
import './styles/bookings.css';
import './styles/settings.css';
import './styles/profile.css';
import './styles/landing.css';

// Before first render; the page has no CSS until this module runs, so there's no flash.
initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
