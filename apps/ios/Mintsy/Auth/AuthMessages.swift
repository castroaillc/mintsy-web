import Foundation

/// Friendly wording for Better Auth's error codes, as the Expo app had it (`src/lib/account.ts`, `social-auth.ts`).
nonisolated enum AuthMessages {
    static func message(forCode code: String) -> String? {
        switch code {
        case "INVALID_PASSWORD": "That password isn’t right. Try again."
        case "INVALID_TOKEN": "This link has expired or was already used. Request a new one."
        case "PASSWORD_TOO_SHORT": "Use at least \(AccountRules.minPasswordLength) characters."
        case "PASSWORD_TOO_LONG": "That password is too long."
        case "SESSION_EXPIRED": "For your security, sign out and sign back in, then try again."
        case "USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL": "That email is already in use."
        case "EMAIL_CAN_NOT_BE_UPDATED": "Email changes aren’t available right now."
        case "CREDENTIAL_ACCOUNT_NOT_FOUND": "This account doesn’t have a password."
        case "PASSWORD_REQUIRED": "Enter your password to confirm."
        case "REAUTH_REQUIRED": "For your security, sign in with Apple again before deleting your account."
        case "OAUTH_LINK_ERROR": "An account with this email already exists. Sign in with your email and password instead."
        case "PROVIDER_NOT_FOUND": "Sign in with Apple isn’t available right now. Use your email instead."
        case "VALIDATION_ERROR": "Check what you entered and try again."
        default: nil
        }
    }
}
