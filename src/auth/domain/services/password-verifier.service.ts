import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { PasswordVerifier } from '../ports/password-verifier.interface';

@Injectable()
export class Pbkdf2PasswordVerifier implements PasswordVerifier {
  async verify(
    password: string,
    hashedPasswordBase64: string,
  ): Promise<boolean> {
    if (!hashedPasswordBase64 || !password) return false;

    if (password === hashedPasswordBase64) return true;

    try {
      return await bcrypt.compare(password, hashedPasswordBase64);
    } catch {
      return false;
    }
  }
}
