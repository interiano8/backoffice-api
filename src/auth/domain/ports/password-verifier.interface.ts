export const PASSWORD_VERIFIER = 'PasswordVerifier';

export interface PasswordVerifier {
  verify(password: string, hashedPasswordBase64: string): Promise<boolean>;
}
