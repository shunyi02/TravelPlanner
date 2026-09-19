import * as SecureStore from 'expo-secure-store';
import type { Balance, Settlement } from '@travel-planner/shared';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  sessionExpiredHandler = handler;
}

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
  members: Array<{ userId: string; role: string; user: { name: string; email: string } }>;
  places: Place[];
  invites: TripInvite[];
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
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
  getMe: () => request<CurrentUser>('/auth/me'),
  listTrips: () => request<Trip[]>('/trips'),
  createTrip: (data: { name: string; startDate?: string; endDate?: string; coverPhoto?: string }) =>
    request<TripDetail>('/trips', { method: 'POST', body: JSON.stringify(data) }),
  getTrip: (tripId: string) => request<TripDetail>(`/trips/${tripId}`),
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
  deletePlace: (tripId: string, placeId: string) =>
    request<void>(`/trips/${tripId}/places/${placeId}`, { method: 'DELETE' }),
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
  updateExpense: (
    tripId: string,
    expenseId: string,
    data: {
      description?: string;
      amount?: number;
      currency?: string;
      paidById?: string;
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
  cancelInvite: (tripId: string, inviteId: string) =>
    request<void>(`/trips/${tripId}/invites/${inviteId}`, { method: 'DELETE' }),
  updateTripDates: (tripId: string, data: { startDate?: string; endDate?: string }) =>
  request<Trip>(`/trips/${tripId}`, { method: 'PATCH', body: JSON.stringify(data) }),
};