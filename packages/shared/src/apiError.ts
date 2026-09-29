/**
 * A failed API call, with a message fit to show the user as is. Web and
 * mobile build these from the response instead of surfacing the raw body.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    /** The HTTP status, or 0 when the server couldn't be reached at all. */
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const NETWORK_ERROR_MESSAGE = "Can't reach the server. Check your connection and try again.";

const FALLBACK_BY_STATUS: Record<number, string> = {
  401: 'Your session has ended. Log in again.',
  403: "You don't have access to that.",
  404: "We couldn't find that. It may have been deleted.",
  413: 'That file is too large. Try a smaller one.',
  429: 'Too many attempts. Wait a minute and try again.',
};

const GENERIC_MESSAGE = 'Something went wrong. Try again.';
const SERVER_MESSAGE = 'Something went wrong on our side. Try again in a moment.';

/** Nest's stock one-word messages ("Unauthorized", "Not Found", ...) say nothing useful. */
const STOCK_MESSAGES = new Set([
  'bad request',
  'unauthorized',
  'forbidden',
  'not found',
  'conflict',
  'payload too large',
  'too many requests',
  'internal server error',
]);

const sentence = (text: string) => {
  const trimmed = text.trim();
  const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
};

/**
 * Turns a failed response into an ApiError. Uses the `message` from a Nest
 * error body (a string, or a list of validation messages) when there is a
 * meaningful one, else a plain message for the status. Server errors never
 * show their details.
 */
export function toApiError(status: number, bodyText: string): ApiError {
  if (status >= 500) return new ApiError(SERVER_MESSAGE, status);

  let message: unknown;
  try {
    message = (JSON.parse(bodyText) as { message?: unknown }).message;
  } catch {
    // Not JSON (e.g. a proxy's HTML error page): fall through to the status message.
  }

  const parts = (Array.isArray(message) ? message : [message]).filter(
    (m): m is string => typeof m === 'string' && m.trim() !== '' && !STOCK_MESSAGES.has(m.trim().toLowerCase()),
  );
  if (status !== 429 && parts.length > 0) {
    return new ApiError(parts.map(sentence).join(' '), status);
  }
  return new ApiError(FALLBACK_BY_STATUS[status] ?? GENERIC_MESSAGE, status);
}
