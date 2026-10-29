/** Password rules and friendly messages for Better Auth account errors, shared by every account form. */

// Better Auth's default minimum password length (sign-up, reset and change use the same rule)
export const MIN_PASSWORD_LENGTH = 8;

/** Inline error for a new password field, or undefined while it's empty or long enough. */
export function newPasswordError(password: string) {
  return password.length > 0 && password.length < MIN_PASSWORD_LENGTH
    ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    : undefined;
}

/** Inline error for a "confirm password" field once something's typed into it. */
export function confirmPasswordError(password: string, confirm: string) {
  return confirm.length > 0 && confirm !== password ? 'Passwords don’t match.' : undefined;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

type AuthError = { code?: string; message?: string; status?: number } | null | undefined;

const MESSAGES: Record<string, string> = {
  INVALID_PASSWORD: 'That password isn’t right. Try again.',
  INVALID_TOKEN: 'This link has expired or was already used. Request a new one.',
  PASSWORD_TOO_SHORT: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  PASSWORD_TOO_LONG: 'That password is too long.',
  SESSION_EXPIRED: 'For your security, sign out and sign back in, then try again.',
  USER_ALREADY_EXISTS: 'That email is already in use.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'That email is already in use.',
  EMAIL_CAN_NOT_BE_UPDATED: 'Email changes aren’t available right now.',
  CREDENTIAL_ACCOUNT_NOT_FOUND: 'This account doesn’t have a password.',
};

/** A message to show for a Better Auth error. Network failures (no status) read as connection problems. */
export function authErrorMessage(error: AuthError, fallback: string) {
  if (!error) return fallback;
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (!error.status) return 'Check your connection and try again.';
  return error.message || fallback;
}
