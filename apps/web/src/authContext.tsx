import { createContext, useContext } from 'react';
import type { CurrentUser } from './api';

export const AuthContext = createContext<{ currentUser: CurrentUser | null }>({ currentUser: null });

export function useAuth() {
  return useContext(AuthContext);
}
