import { ApiError, toApiError } from './apiError';

const body = (message: unknown, statusCode = 400) => JSON.stringify({ message, error: 'Bad Request', statusCode });

describe('toApiError', () => {
  it('uses the message from a Nest error body, not the raw body', () => {
    const err = toApiError(401, body('Invalid email or password', 401));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.message).toBe('Invalid email or password.');
  });

  it('joins a list of validation messages into sentences', () => {
    const err = toApiError(400, body(['Phone must be a phone number', 'Nationality must be a country from the list.']));
    expect(err.message).toBe('Phone must be a phone number. Nationality must be a country from the list.');
  });

  it("falls back to a plain message for Nest's stock one-word messages", () => {
    expect(toApiError(403, body('Forbidden', 403)).message).toBe("You don't have access to that.");
    expect(toApiError(401, body('Unauthorized', 401)).message).toBe('Your session has ended. Log in again.');
  });

  it('never shows server error details', () => {
    const err = toApiError(500, body('PrismaClientKnownRequestError: column "x" does not exist', 500));
    expect(err.message).toBe('Something went wrong on our side. Try again in a moment.');
  });

  it('handles a body that is not JSON', () => {
    expect(toApiError(413, '<html>Request Entity Too Large</html>').message).toBe('That file is too large. Try a smaller one.');
    expect(toApiError(418, '').message).toBe('Something went wrong. Try again.');
  });

  it('always uses the friendly rate-limit message', () => {
    expect(toApiError(429, body('ThrottlerException: Too Many Requests', 429)).message).toBe(
      'Too many attempts. Wait a minute and try again.',
    );
  });
});
