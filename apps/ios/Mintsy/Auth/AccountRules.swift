import Foundation

/// Password and email rules shared by every account form, as in the Expo app's `src/lib/account.ts`.
nonisolated enum AccountRules {
    /// Better Auth's default minimum (sign-up, reset and change all use it).
    static let minPasswordLength = 8

    /// The inline error for a new password, or nil while it's empty or long enough.
    static func newPasswordError(_ password: String) -> String? {
        !password.isEmpty && password.count < minPasswordLength ? "Use at least \(minPasswordLength) characters." : nil
    }

    /// The inline error for a "confirm password" field once something's typed into it.
    static func confirmPasswordError(_ password: String, _ confirm: String) -> String? {
        !confirm.isEmpty && confirm != password ? "Passwords don’t match." : nil
    }

    static func isValidPassword(_ password: String) -> Bool {
        password.count >= minPasswordLength
    }

    /// Something@something.something, without spaces: enough to catch typos before the server does.
    static func isValidEmail(_ email: String) -> Bool {
        email.trimmingCharacters(in: .whitespacesAndNewlines).wholeMatch(of: /[^\s@]+@[^\s@]+\.[^\s@]+/) != nil
    }

    /// Same address, ignoring case and surrounding spaces.
    static func isSameEmail(_ a: String, _ b: String) -> Bool {
        a.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == b.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
