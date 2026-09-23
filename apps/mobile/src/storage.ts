import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** expo-secure-store has no web implementation — there's no OS keychain to
 *  back it in a browser — so it throws on every call there. Fall back to
 *  localStorage on web; native platforms keep using the real keychain via
 *  SecureStore. Not a security-equivalent swap (localStorage isn't
 *  encrypted at rest), but matches what a browser can actually offer, and
 *  only ever applies when running the web target. Shared by api.ts (auth
 *  tokens) and theme.tsx (theme preference) so this fallback lives in one place. */
export const storage =
  Platform.OS === 'web'
    ? {
        getItemAsync: async (key: string) => window.localStorage.getItem(key),
        setItemAsync: async (key: string, value: string) => {
          window.localStorage.setItem(key, value);
        },
        deleteItemAsync: async (key: string) => {
          window.localStorage.removeItem(key);
        },
      }
    : SecureStore;
