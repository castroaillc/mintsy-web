import Foundation

/// Why a Better Auth call failed.
nonisolated enum AuthError: Error, Equatable, Sendable {
    /// `INVALID_EMAIL_OR_PASSWORD`
    case invalidCredentials
    /// Any other error Better Auth answered with: its `code` (e.g. `INVALID_ORIGIN`) and message.
    case server(status: Int, code: String?, message: String?)
    case network(URLError.Code)
    case decoding(String)

    /// Better Auth's `code`, when the server answered with one.
    var code: String? {
        switch self {
        case .invalidCredentials: "INVALID_EMAIL_OR_PASSWORD"
        case .server(_, let code, _): code
        case .network, .decoding: nil
        }
    }

    /// The message for a form, with `fallback` for server answers that have no friendlier wording.
    func message(fallback: String) -> String {
        switch self {
        case .server(_, let code, _):
            code.flatMap(AuthMessages.message(forCode:)) ?? fallback
        default:
            errorDescription ?? fallback
        }
    }
}

extension AuthError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            "That email and password don’t match. Try again or reset your password."
        case .server(_, let code, let message):
            code.flatMap(AuthMessages.message(forCode:)) ?? message ?? "Something went wrong. Try again."
        case .network(.notConnectedToInternet), .network(.networkConnectionLost):
            "You're offline. Check your connection and try again."
        case .network:
            "Couldn't reach mintsy. Try again in a moment."
        case .decoding:
            "The server's answer couldn't be read."
        }
    }
}
