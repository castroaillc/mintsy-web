import Foundation

/// What opening a change-email link did.
nonisolated enum EmailChangeOutcome: Equatable, Sendable {
    case checking
    /// Signed in: the session now has this address.
    case changed(String)
    /// Signed out: confirmed, sign in with the new address.
    case confirmed
    case failed(String)

    /// Better Auth's `?error=` codes for the link.
    static func message(for code: String) -> String {
        switch code.uppercased() {
        case "TOKEN_EXPIRED": "This confirmation link has expired."
        case "INVALID_TOKEN": "This confirmation link isn’t valid."
        case "USER_NOT_FOUND": "This confirmation link was already used."
        case "INVALID_USER": "This link belongs to a different account than the one signed in."
        default: "We couldn’t confirm your new email."
        }
    }
}
