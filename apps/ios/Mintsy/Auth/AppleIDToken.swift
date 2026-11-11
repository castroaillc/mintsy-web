import Foundation

/// What Sign in with Apple hands back, ready for Better Auth's `POST /sign-in/social`.
nonisolated struct AppleIDToken: Equatable, Sendable {
    /// The identity token (a JWT whose audience is the app's bundle ID).
    let token: String
    /// The raw nonce. Apple got its SHA-256; Better Auth compares the hash.
    let nonce: String
    /// Apple shares the name only on the first authorization, and only here (it isn't in the token).
    let givenName: String?
    let familyName: String?
}
