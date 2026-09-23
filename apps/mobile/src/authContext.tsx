import { createContext, useContext } from 'react';
import type { CurrentUser } from './api';

export const AuthContext = createContext<{
  logout: () => void;
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;
}>({
  logout: () => {},
  currentUser: null,
  setCurrentUser: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
