import type { ValidationError } from 'class-validator';
import { fieldLabel, validationException } from './validation-exception';

const error = (property: string, constraints: Record<string, string>, children: ValidationError[] = []) =>
  ({ property, constraints, children }) as ValidationError;

describe('fieldLabel', () => {
  it('turns a camelCase property into a sentence-case label', () => {
    expect(fieldLabel('passportNumber')).toBe('Passport number');
    expect(fieldLabel('dateOfBirth')).toBe('Date of birth');
    expect(fieldLabel('email')).toBe('Email');
  });
});

describe('validationException', () => {
  it('replaces the leading property name in each message', () => {
    const exception = validationException([
      error('email', { isEmail: 'email must be an email' }),
      error('newPassword', { minLength: 'newPassword must be longer than or equal to 8 characters' }),
    ]);
    expect(exception.getResponse()).toMatchObject({
      message: ['Email must be an email', 'New password must be longer than or equal to 8 characters'],
      statusCode: 400,
    });
  });

  it('leaves custom messages that do not start with the property alone, and flattens nested errors', () => {
    const exception = validationException([
      error('splits', {}, [error('0', {}, [error('amount', { min: 'amount must not be less than 0' })])]),
      error('name', { custom: 'Pick a shorter name' }),
    ]);
    expect((exception.getResponse() as { message: string[] }).message).toEqual([
      'Amount must not be less than 0',
      'Pick a shorter name',
    ]);
  });
});
