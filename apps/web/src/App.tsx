import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TripDetailPage } from './pages/TripDetailPage';
import { AuthPage } from './pages/AuthPage';
import { isLoggedIn, setSessionExpiredHandler } from './api';

function EmptySelection() {
  return (
    <div className="main">
      <p className="empty-state">Select a trip on the left, or add a new one.</p>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn());

  useEffect(() => {
    setSessionExpiredHandler(() => setAuthed(false));
  }, []);

  if (!authed) {
    return <AuthPage onAuthed={() => setAuthed(true)} />;
  }

  return (
    <div className="app-shell">
      <Sidebar onLogout={() => setAuthed(false)} />
      <Routes>
        <Route path="/" element={<EmptySelection />} />
        <Route path="/trips/:tripId" element={<TripDetailPage />} />
      </Routes>
    </div>
  );
}
