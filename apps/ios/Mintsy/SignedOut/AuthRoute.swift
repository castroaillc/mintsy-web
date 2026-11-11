import Foundation

/// Screens pushed over Welcome.
nonisolated enum AuthRoute: Hashable, Sendable {
    case signIn, signUp, forgotPassword
}
