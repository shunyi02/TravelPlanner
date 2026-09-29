import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/** "passportNumber" becomes "Passport number". */
export function fieldLabel(property: string): string {
  const words = property.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The ValidationPipe's exceptionFactory. class-validator messages start with
 * the DTO property name ("passportNumber must be ..."); this swaps it for a
 * readable label ("Passport number must be ...") so the apps can show the
 * message as is. Nested errors (array items, child objects) are flattened.
 * The response keeps Nest's usual shape: { message: string[], ... }.
 */
export function validationException(errors: ValidationError[]): BadRequestException {
  const messages: string[] = [];
  const collect = (error: ValidationError) => {
    for (const message of Object.values(error.constraints ?? {})) {
      messages.push(
        message.startsWith(error.property)
          ? fieldLabel(error.property) + message.slice(error.property.length)
          : message,
      );
    }
    error.children?.forEach(collect);
  };
  errors.forEach(collect);
  return new BadRequestException(messages);
}
