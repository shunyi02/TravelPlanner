import { createContext, useContext } from 'react';

export const AuthContext = createContext<{ logout: () => void }>({ logout: () => {} });

export function useAuth() {
  return useContext(AuthContext);
}
