import { createContext, useContext } from 'react';
import type { CurrentUser } from './api';

export const AuthContext = createContext<{ currentUser: CurrentUser | null; onLogout: () => void }>({
  currentUser: null,
  onLogout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
