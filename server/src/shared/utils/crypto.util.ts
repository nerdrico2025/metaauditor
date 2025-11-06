
import crypto from 'crypto';

export class CryptoUtil {
  /**
   * Gera um hash SHA-256 de uma string
   */
  static sha256(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Gera um token aleatório seguro
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Gera um UUID v4
   */
  static generateUuid(): string {
    return crypto.randomUUID();
  }
}
