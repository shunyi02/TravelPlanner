import { useEffect, useRef, useState } from 'react';
import { Link, Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TripsLandingPage } from './pages/TripsLandingPage';
import { TripDetailPage } from './pages/TripDetailPage';
import { AuthPage } from './pages/AuthPage';
import { api, isLoggedIn, setSessionExpiredHandler, type CurrentUser } from './api';
import { AuthContext, useAuth } from './authContext';
import { initials } from './format';

function TopBar() {
  const { currentUser, onLogout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleLogout = () => {
    api.logout();
    onLogout();
  };

  return (
    <header className="top-bar">
      <Link to="/" className="top-bar-brand">
        <span className="top-bar-logo" />
        <span className="top-bar-name">Cuti</span>
      </Link>
      <div className="top-bar-account">
        <div className="top-bar-profile" ref={menuRef}>
          <button
            type="button"
            className="top-bar-profile-btn"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
          >
            <span className="top-bar-avatar">{currentUser ? initials(currentUser.name) : ''}</span>
            <span>{currentUser?.name ?? 'Profile'}</span>
          </button>
          {menuOpen && currentUser && (
            <div className="top-bar-profile-menu">
              <p className="top-bar-profile-name">{currentUser.name}</p>
              <p className="top-bar-profile-email">{currentUser.email}</p>
            </div>
          )}
        </div>
        <button type="button" className="text-btn" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}

function AuthedApp({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const showSidebar = location.pathname !== '/';
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    api.getMe().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, onLogout }}>
      <TopBar />
      <div className="app-shell" style={!showSidebar ? { gridTemplateColumns: '1fr' } : undefined}>
        {showSidebar && <Sidebar />}
        <Routes>
          <Route path="/" element={<TripsLandingPage />} />
          <Route path="/trips/:tripId" element={<TripDetailPage />} />
        </Routes>
      </div>
    </AuthContext.Provider>
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
