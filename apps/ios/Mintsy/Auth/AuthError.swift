import Foundation

/// Why a Better Auth call failed.
nonisolated enum AuthError: Error, Equatable, Sendable {
    /// `INVALID_EMAIL_OR_PASSWORD`
    case invalidCredentials
    /// Any other error Better Auth answered with: its `code` (e.g. `INVALID_ORIGIN`) and message.
    case server(status: Int, code: String?, message: String?)
    case network(URLError.Code)
    case decoding(String)
}

extension AuthError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            "That email and password don’t match. Try again or reset your password."
        case .server(_, _, let message):
            message ?? "Unable to sign in."
        case .network(.notConnectedToInternet), .network(.networkConnectionLost):
            "You're offline. Check your connection and try again."
        case .network:
            "Couldn't reach mintsy. Try again in a moment."
        case .decoding:
            "The server's answer couldn't be read."
        }
    }
}
