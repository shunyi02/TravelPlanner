import { createContext, useContext } from 'react';
import type { CurrentUser } from './api';

export const AuthContext = createContext<{
  currentUser: CurrentUser | null;
  onLogout: () => void;
  setCurrentUser: (user: CurrentUser) => void;
}>({
  currentUser: null,
  onLogout: () => {},
  setCurrentUser: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
