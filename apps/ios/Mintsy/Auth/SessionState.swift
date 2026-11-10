import Foundation

/// Where the app is with the viewer's session.
nonisolated enum SessionState: Equatable, Sendable {
    /// Launching: reading the Keychain, or asking the API about a stored session with no cached user.
    case restoring
    case signedOut
    case signedIn(AuthUser)
    /// A session cookie is stored but the API couldn't be reached to say whose it is.
    case restoreFailed(String)

    var user: AuthUser? {
        if case .signedIn(let user) = self { user } else { nil }
    }
}
