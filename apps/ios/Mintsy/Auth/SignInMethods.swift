import Foundation

/// How the signed-in user can sign in, from Better Auth's `GET /list-accounts`.
nonisolated struct SignInMethods: Equatable, Sendable {
    /// An email and password (`credential`) account.
    let hasPassword: Bool
    /// The first social provider linked (`apple`, `google`), if any.
    let socialProvider: String?

    /// While unknown (or if loading fails), act as if there's a password: the forms then ask for it, which is safe.
    static let assumed = SignInMethods(hasPassword: true, socialProvider: nil)

    init(hasPassword: Bool, socialProvider: String?) {
        self.hasPassword = hasPassword
        self.socialProvider = socialProvider
    }

    init(providerIDs: [String]) {
        hasPassword = providerIDs.contains("credential")
        socialProvider = providerIDs.first { $0 != "credential" }
    }

    /// Apple- or Google-only: no password, and the email comes from the provider.
    var isSocialOnly: Bool { !hasPassword }

    /// "Apple", "Google", for "You sign in with Apple".
    var providerName: String {
        switch socialProvider {
        case "apple": "Apple"
        case "google": "Google"
        case let other?: other.capitalized
        case nil: "another account"
        }
    }
}
