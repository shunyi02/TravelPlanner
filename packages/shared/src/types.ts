export interface UserDto {
  id: string;
  email: string;
  name: string;
}

export interface TripDto {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
}

export interface PlaceDto {
  id: string;
  tripId: string;
  name: string;
  lat: number | null;
  lng: number | null;
  visitDate: string | null;
  order: number | null;
  notes: string | null;
}

export interface ExpenseSplitInput {
  userId: string;
  /** Fraction of the expense this user owes, e.g. 0.5. Must sum to 1 across all splits. */
  share: number;
}

export interface ExpenseDto {
  id: string;
  tripId: string;
  description: string;
  amount: string; // decimal as string to avoid float precision issues over the wire
  currency: string;
  paidById: string;
  splits: Array<{ userId: string; amountOwed: string; settled: boolean }>;
}

/** Net balance for one user within a trip: positive = is owed money, negative = owes money. */
export interface Balance {
  userId: string;
  amount: number;
}

/** A single suggested payment to settle up. */
export interface Settlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export interface AccommodationDto {
  id: string;
  tripId: string;
  name: string;
  checkInDate: string;
  checkOutDate: string;
  notes: string | null;
}
