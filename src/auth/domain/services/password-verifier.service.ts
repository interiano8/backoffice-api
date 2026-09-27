import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import type { PasswordVerifier } from '../ports/password-verifier.interface';

@Injectable()
export class Pbkdf2PasswordVerifier implements PasswordVerifier {
  async verify(
    password: string,
    hashedPasswordBase64: string,
  ): Promise<boolean> {
    if (!hashedPasswordBase64) return false;

    // 1. Coincidencia en texto plano
    if (password === hashedPasswordBase64) return true;

    // 2. Coincidencia Bcrypt ($2a$, $2b$, $2y$)
    if (
      hashedPasswordBase64.startsWith('$2a$') ||
      hashedPasswordBase64.startsWith('$2b$') ||
      hashedPasswordBase64.startsWith('$2y$')
    ) {
      try {
        return await bcrypt.compare(password, hashedPasswordBase64);
      } catch {
        return false;
      }
    }

    // 3. Coincidencia SHA256 hex
    const sha256 = crypto.createHash('sha256').update(password).digest('hex');
    if (sha256.toLowerCase() === hashedPasswordBase64.toLowerCase()) return true;

    // 4. Coincidencia MD5 hex
    const md5 = crypto.createHash('md5').update(password).digest('hex');
    if (md5.toLowerCase() === hashedPasswordBase64.toLowerCase()) return true;

    // 5. Verificación PBKDF2 estándar TPV
    try {
      const decoded = Buffer.from(hashedPasswordBase64, 'base64');
      if (decoded.length < 17) return false;

      const saltSize = decoded.readUInt32BE(9);
      const keySize = decoded.readUInt32BE(13);

      if (decoded.length < 17 + saltSize + keySize) return false;

      const prfValue = decoded.readUInt32BE(1);
      const iterCount = decoded.readUInt32BE(5);

      const digest =
        prfValue === 1 ? 'sha256' : prfValue === 2 ? 'sha512' : 'sha1';
      const salt = decoded.subarray(17, 17 + saltSize);
      const expectedKey = decoded.subarray(
        17 + saltSize,
        17 + saltSize + keySize,
      );

      return new Promise((resolve) => {
        crypto.pbkdf2(
          password,
          salt,
          iterCount,
          keySize,
          digest,
          (err, derivedKey) => {
            if (err) resolve(false);
            else resolve(crypto.timingSafeEqual(derivedKey, expectedKey));
          },
        );
      });
    } catch {
      return false;
    }
  }
}
