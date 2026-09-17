import type { Balance, Settlement } from '@travel-planner/shared';

const BASE_URL = '/api';
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

let sessionExpiredHandler: (() => void) | null = null;

/** App root registers this so it can drop back to the login screen when a
 * refresh attempt fails (e.g. refresh token expired or revoked elsewhere). */
export function setSessionExpiredHandler(handler: () => void) {
  sessionExpiredHandler = handler;
}

function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function persistTokens(tokens: { accessToken: string; refreshToken: string }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null;
}

async function rawRequest(path: string, options: RequestInit, token: string | null): Promise<Response> {
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

async function refreshTokens(currentRefreshToken: string) {
  const res = await rawRequest(
    '/auth/refresh',
    { method: 'POST', body: JSON.stringify({ refreshToken: currentRefreshToken }) },
    null,
  );
  return parseOrThrow<{ accessToken: string; refreshToken: string }>(res);
}

/**
 * On a 401, tries once to exchange the stored refresh token for a new pair
 * and retries the original request. Only gives up (and signals the app to
 * log out) if that also fails.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawRequest(path, options, getAccessToken());

  if (res.status === 401) {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        const tokens = await refreshTokens(refresh);
        persistTokens(tokens);
        res = await rawRequest(path, options, tokens.accessToken);
      } catch {
        clearTokens();
        sessionExpiredHandler?.();
        throw new Error('Session expired, please log in again');
      }
    } else {
      clearTokens();
      sessionExpiredHandler?.();
      throw new Error('Session expired, please log in again');
    }
  }

  if (res.status === 401) {
    clearTokens();
    sessionExpiredHandler?.();
    throw new Error('Session expired, please log in again');
  }

  return parseOrThrow<T>(res);
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

export interface Accommodation {
  id: string;
  tripId: string;
  name: string;
  checkInDate: string;
  checkOutDate: string;
  notes: string | null;
}

export interface TripDetail extends Trip {
  members: Array<{ userId: string; role: string; coverPhoto: string | null; user: { name: string; email: string } }>;
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
    const res = await rawRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) }, null);
    const tokens = await parseOrThrow<{ accessToken: string; refreshToken: string }>(res);
    persistTokens(tokens);
    return tokens;
  },
  login: async (data: { email: string; password: string }) => {
    const res = await rawRequest('/auth/login', { method: 'POST', body: JSON.stringify(data) }, null);
    const tokens = await parseOrThrow<{ accessToken: string; refreshToken: string }>(res);
    persistTokens(tokens);
    return tokens;
  },
  logout: () => clearTokens(),
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
  updateTripDates: (tripId: string, data: { startDate?: string; endDate?: string }) =>
  request<Trip>(`/trips/${tripId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getTrip: (tripId: string) => request<TripDetail>(`/trips/${tripId}`),
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
  addPlace: (tripId: string, data: { name: string; lat?: number; lng?: number; notes?: string; visitDate?: string }) =>
  request<Place>(`/trips/${tripId}/places`, { method: 'POST', body: JSON.stringify(data) }),
  deleteTrip: (tripId: string) =>
  request<void>(`/trips/${tripId}`, { method: 'DELETE' }),
  addAccommodation: (tripId: string, data: { name: string; checkInDate: string; checkOutDate: string; notes?: string }) =>
    request<Accommodation>(`/trips/${tripId}/accommodations`, { method: 'POST', body: JSON.stringify(data) }),
  deleteAccommodation: (tripId: string, accommodationId: string) =>
    request<void>(`/trips/${tripId}/accommodations/${accommodationId}`, { method: 'DELETE' }),
};
