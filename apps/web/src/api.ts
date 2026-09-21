import type { Balance, Settlement } from '@travel-planner/shared';

const BASE_URL = '/api';
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

let sessionExpiredHandler: (() => void) | null = null;

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
  currency: string;
  budget: string | null;
  destinationName: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
}

export type PlaceType = 'STOP' | 'HOTEL' | 'FLIGHT';

export interface Place {
  id: string;
  tripId: string;
  type: PlaceType;
  name: string;
  lat: number | null;
  lng: number | null;
  visitDate: string | null;
  order: number | null;
  notes: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  checkIn: string | null;
  checkOut: string | null;
}

export interface TripInvite {
  id: string;
  email: string;
  createdAt: string;
}

export interface TripDetail extends Trip {
  members: Array<{
    userId: string;
    role: string;
    coverPhoto: string | null;
    user: { name: string; email: string; isPlaceholder: boolean };
  }>;
  places: Place[];
  invites: TripInvite[];
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
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
  category: string;
  expenseDate: string;
  subtotal: string | null;
  servicePct: string | null;
  taxPct: string | null;
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
  getMe: () => request<CurrentUser>('/auth/me'),
  updateProfile: (data: { name?: string; avatarUrl?: string }) =>
    request<CurrentUser>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  listTrips: () => request<Trip[]>('/trips'),
  createTrip: (data: {
    name: string;
    startDate?: string;
    endDate?: string;
    coverPhoto?: string;
    currency?: string;
    budget?: number;
    destinationName?: string;
    destinationLat?: number;
    destinationLng?: number;
  }) => request<TripDetail>('/trips', { method: 'POST', body: JSON.stringify(data) }),
  updateTrip: (
    tripId: string,
    data: {
      startDate?: string;
      endDate?: string;
      currency?: string;
      budget?: number | null;
      destinationName?: string;
      destinationLat?: number;
      destinationLng?: number;
    },
  ) => request<Trip>(`/trips/${tripId}`, { method: 'PATCH', body: JSON.stringify(data) }),
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
      paidById?: string;
      category?: string;
      expenseDate?: string;
      subtotal?: number;
      servicePct?: number;
      taxPct?: number;
      splits?: Array<{ userId: string; share: number }>;
    },
  ) => request<Expense>(`/trips/${tripId}/expenses`, { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (
    tripId: string,
    expenseId: string,
    data: {
      description?: string;
      amount?: number;
      paidById?: string;
      category?: string;
      expenseDate?: string;
      subtotal?: number | null;
      servicePct?: number | null;
      taxPct?: number | null;
      splits?: Array<{ userId: string; share: number }>;
    },
  ) =>
    request<Expense>(`/trips/${tripId}/expenses/${expenseId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteExpense: (tripId: string, expenseId: string) =>
    request<void>(`/trips/${tripId}/expenses/${expenseId}`, { method: 'DELETE' }),
  setSplitSettled: (tripId: string, expenseId: string, splitUserId: string, settled: boolean) =>
    request<ExpenseSplit>(`/trips/${tripId}/expenses/${expenseId}/splits/${splitUserId}`, {
      method: 'PATCH',
      body: JSON.stringify({ settled }),
    }),
  getBalances: (tripId: string) => request<Balance[]>(`/trips/${tripId}/splits/balances`),
  getSettlements: (tripId: string) => request<Settlement[]>(`/trips/${tripId}/splits/settlements`),
  inviteMember: (tripId: string, email: string) =>
    request<TripInvite | { userId: string; role: string }>(`/trips/${tripId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  /**
   * Adds a member by name and, optionally, a real email — no registration
   * required. Usable in expense splits immediately; if the email later
   * registers, that account takes over this same membership.
   */
  addManualMember: (tripId: string, data: { name: string; email?: string }) =>
    request<{ userId: string; role: string }>(`/trips/${tripId}/members/manual`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancelInvite: (tripId: string, inviteId: string) =>
    request<void>(`/trips/${tripId}/invites/${inviteId}`, { method: 'DELETE' }),
  addPlace: (
    tripId: string,
    data: {
      type: PlaceType;
      name: string;
      lat?: number;
      lng?: number;
      notes?: string;
      visitDate?: string;
      departureTime?: string;
      arrivalTime?: string;
      departureAirport?: string;
      arrivalAirport?: string;
      checkIn?: string;
      checkOut?: string;
    },
  ) => request<Place>(`/trips/${tripId}/places`, { method: 'POST', body: JSON.stringify(data) }),
  updatePlace: (
    tripId: string,
    placeId: string,
    data: Partial<{
      type: PlaceType;
      name: string;
      lat: number;
      lng: number;
      notes: string;
      visitDate: string;
      departureTime: string;
      arrivalTime: string;
      departureAirport: string;
      arrivalAirport: string;
      checkIn: string;
      checkOut: string;
    }>,
  ) => request<Place>(`/trips/${tripId}/places/${placeId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTrip: (tripId: string) =>
  request<void>(`/trips/${tripId}`, { method: 'DELETE' }),
  deletePlace: (tripId: string, placeId: string) =>
  request<void>(`/trips/${tripId}/places/${placeId}`, { method: 'DELETE' }),
};