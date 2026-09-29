import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // the GCM standard nonce size
const KEY_BYTES = 32;

/**
 * Encrypts sensitive user fields (the passport number) before they reach the
 * database, so a DB dump or backup holds only ciphertext. AES-256-GCM: the
 * auth tag also makes decrypt fail loudly on a tampered value.
 *
 * Stored format: "iv:authTag:ciphertext", each part base64.
 *
 * The key comes from FIELD_ENCRYPTION_KEY (32 random bytes, base64). Losing it
 * makes every encrypted value unrecoverable, so it must be backed up outside
 * the database. Constructing this service without a valid key throws, which
 * stops the app at startup instead of failing on the first profile save.
 */
@Injectable()
export class FieldCipherService {
  private readonly key: Buffer;

  constructor() {
    const raw = process.env.FIELD_ENCRYPTION_KEY;
    if (!raw) throw new Error('FIELD_ENCRYPTION_KEY is not set');
    const key = Buffer.from(raw, 'base64');
    if (key.length !== KEY_BYTES) {
      throw new Error(`FIELD_ENCRYPTION_KEY must be ${KEY_BYTES} bytes, base64-encoded`);
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join(':');
  }

  decrypt(stored: string): string {
    const [iv, authTag, ciphertext] = stored.split(':').map((part) => Buffer.from(part, 'base64'));
    if (!iv || !authTag || !ciphertext) throw new Error('Malformed encrypted field');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}
