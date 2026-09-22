import { useEffect, useRef, useState } from 'react';
import { Link, Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TripsLandingPage } from './pages/TripsLandingPage';
import { TripDetailPage } from './pages/TripDetailPage';
import { AuthPage } from './pages/AuthPage';
import { LandingPage } from './pages/LandingPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { api, getResetToken, isLoggedIn, setSessionExpiredHandler, type CurrentUser } from './api';
import { AuthContext, useAuth } from './authContext';
import { initials } from './format';

const NO_SIDEBAR_PATHS = ['/', '/profile', '/settings'];

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
            <span className="top-bar-avatar">
              {currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" className="top-bar-avatar-img" />
              ) : (
                currentUser ? initials(currentUser.name) : ''
              )}
            </span>
            <span>{currentUser?.name ?? 'Profile'}</span>
          </button>
          {menuOpen && currentUser && (
            <div className="top-bar-profile-menu">
              <Link
                to="/profile"
                className="top-bar-profile-menu-item"
                onClick={() => setMenuOpen(false)}
              >
                Profile
              </Link>
              <Link
                to="/settings"
                className="top-bar-profile-menu-item"
                onClick={() => setMenuOpen(false)}
              >
                Settings
              </Link>
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
  const showSidebar = !NO_SIDEBAR_PATHS.includes(location.pathname);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    api.getMe().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, onLogout, setCurrentUser }}>
      <TopBar />
      <div className="app-shell" style={!showSidebar ? { gridTemplateColumns: '1fr' } : undefined}>
        {showSidebar && <Sidebar />}
        <Routes>
          <Route path="/" element={<TripsLandingPage />} />
          <Route path="/trips/:tripId" element={<TripDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </AuthContext.Provider>
  );
}


export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn());
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    setSessionExpiredHandler(() => setAuthed(false));
  }, []);

  const handleLogout = () => {
    setAuthed(false);
    setShowAuth(false);
  };

  if (!authed) {
    const resetToken = getResetToken();
    if (resetToken || showAuth) {
      return (
        <AuthPage
          onAuthed={() => setAuthed(true)}
          initialMode={authMode}
          onBack={resetToken ? undefined : () => setShowAuth(false)}
        />
      );
    }
    return (
      <LandingPage
        onLogin={() => {
          setAuthMode('login');
          setShowAuth(true);
        }}
        onGetStarted={() => {
          setAuthMode('register');
          setShowAuth(true);
        }}
      />
    );
  }

  return <AuthedApp onLogout={handleLogout} />;
}
