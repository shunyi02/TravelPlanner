import * as SecureStore from 'expo-secure-store';
import type { Balance, Settlement } from '@travel-planner/shared';

/**
 * Expo inlines any env var prefixed EXPO_PUBLIC_ at build time.
 * Set this in apps/mobile/.env (see .env.example) to point at your backend.
 *
 * NOTE: "localhost" means different things depending on where the app runs:
 * - iOS simulator: localhost works (shares the host's network).
 * - Android emulator: use 10.0.2.2 instead of localhost.
 * - Physical device: use your computer's LAN IP (e.g. 192.168.x.x), and
 *   make sure the device and computer are on the same network.
 * This scaffold does not auto-detect which case you're in — set the right
 * value for your environment.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;

/** Root layout registers this so the app can drop back to the login screen
 * when a refresh attempt fails (e.g. refresh token expired or revoked). */
export function setSessionExpiredHandler(handler: () => void) {
  sessionExpiredHandler = handler;
}

/** Call once at app startup, before rendering, to restore a persisted session. */
export async function initAuth(): Promise<boolean> {
  accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  return accessToken !== null;
}

async function persistTokens(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return accessToken !== null;
}

async function rawRequest<T>(path: string, options: RequestInit, token: string | null): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * Wraps fetch with automatic access-token refresh: on a 401, tries once to
 * exchange the stored refresh token for a new pair and retries the original
 * request. Only gives up (and signals the app to log out) if that also fails.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawRequest<T>(path, options, accessToken);

  if (res.status === 401 && refreshToken) {
    try {
      const refreshed = await refreshTokens(refreshToken);
      await persistTokens(refreshed);
      res = await rawRequest<T>(path, options, accessToken);
    } catch {
      await clearTokens();
      sessionExpiredHandler?.();
      throw new Error('Session expired, please log in again');
    }
  }

  if (res.status === 401) {
    await clearTokens();
    sessionExpiredHandler?.();
    throw new Error('Session expired, please log in again');
  }

  return parseOrThrow<T>(res);
}

async function refreshTokens(currentRefreshToken: string) {
  const res = await rawRequest<{ accessToken: string; refreshToken: string }>(
    '/auth/refresh',
    { method: 'POST', body: JSON.stringify({ refreshToken: currentRefreshToken }) },
    null,
  );
  return parseOrThrow<{ accessToken: string; refreshToken: string }>(res);
}

export interface Trip {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  coverPhoto: string | null;
}

export interface Place {
  id: string;
  tripId: string;
  name: string;
  lat: number | null;
  lng: number | null;
  visitDate: string | null;
  order: number | null;
  notes: string | null;
}

export interface TripDetail extends Trip {
  members: Array<{ userId: string; role: string; user: { name: string; email: string } }>;
  places: Place[];
}

export interface ExpenseSplit {
  userId: string;
  amountOwed: string;
  settled: boolean;
}

export interface Expense {
  id: string;
  tripId: string;
  description: string;
  amount: string;
  currency: string;
  paidById: string;
  splits: ExpenseSplit[];
  createdAt: string;
}

export const api = {
  register: async (data: { email: string; name: string; password: string }) => {
    const res = await rawRequest<{ accessToken: string; refreshToken: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(data) },
      null,
    );
    const tokens = await parseOrThrow<{ accessToken: string; refreshToken: string }>(res);
    await persistTokens(tokens);
    return tokens;
  },
  login: async (data: { email: string; password: string }) => {
    const res = await rawRequest<{ accessToken: string; refreshToken: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(data) },
      null,
    );
    const tokens = await parseOrThrow<{ accessToken: string; refreshToken: string }>(res);
    await persistTokens(tokens);
    return tokens;
  },
  logout: async () => {
    await clearTokens();
  },
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
  listTrips: () => request<Trip[]>('/trips'),
  createTrip: (data: { name: string; startDate?: string; endDate?: string; coverPhoto?: string }) =>
    request<TripDetail>('/trips', { method: 'POST', body: JSON.stringify(data) }),
  getTrip: (tripId: string) => request<TripDetail>(`/trips/${tripId}`),
  addPlace: (tripId: string, data: { name: string; lat?: number; lng?: number; notes?: string }) =>
    request<Place>(`/trips/${tripId}/places`, { method: 'POST', body: JSON.stringify(data) }),
  reorderPlaces: (tripId: string, orderedPlaceIds: string[]) =>
    request<Place[]>(`/trips/${tripId}/places/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ orderedPlaceIds }),
    }),
  listExpenses: (tripId: string) => request<Expense[]>(`/trips/${tripId}/expenses`),
  createExpense: (
    tripId: string,
    data: {
      description: string;
      amount: number;
      currency?: string;
      paidById?: string;
      splits?: Array<{ userId: string; share: number }>;
    },
  ) => request<Expense>(`/trips/${tripId}/expenses`, { method: 'POST', body: JSON.stringify(data) }),
  getBalances: (tripId: string) => request<Balance[]>(`/trips/${tripId}/splits/balances`),
  getSettlements: (tripId: string) => request<Settlement[]>(`/trips/${tripId}/splits/settlements`),
};
