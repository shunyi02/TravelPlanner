import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TripsLandingPage } from './pages/TripsLandingPage';
import { TripDetailPage } from './pages/TripDetailPage';
import { AuthPage } from './pages/AuthPage';
import { isLoggedIn, setSessionExpiredHandler } from './api';

function AuthedApp({ onLogout }: { onLogout: () => void }) {
const location = useLocation();
const showSidebar = location.pathname !== '/';

return (
  <div className="app-shell" style={!showSidebar ? { gridTemplateColumns: '1fr' } : undefined}>
     {showSidebar && <Sidebar onLogout={onLogout} />}
      <Routes>
        <Route path="/" element={<TripsLandingPage />} />
        <Route path="/trips/:tripId" element={<TripDetailPage />} />
      </Routes>
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

  return <AuthedApp onLogout={() => setAuthed(false)} />;
}
