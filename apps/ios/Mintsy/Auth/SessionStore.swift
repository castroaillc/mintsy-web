import Foundation
import Observation

/// The viewer's Better Auth session: restored from the Keychain on launch, then confirmed with the API.
@Observable
final class SessionStore {
    private(set) var state: SessionState = .restoring

    @ObservationIgnored private let auth: AuthService
    @ObservationIgnored private let credentials: CredentialStore

    init(auth: AuthService, credentials: CredentialStore) {
        self.auth = auth
        self.credentials = credentials
    }

    /// Launch: no stored session is signed out at once. A stored one with a cached user is signed in at once and
    /// then confirmed (a session revoked elsewhere signs out). Without a cached user, this waits for the API.
    func restore() async {
        guard await credentials.hasSession() else {
            state = .signedOut
            return
        }
        if let cached = await credentials.cachedUser() {
            state = .signedIn(cached)
        } else {
            state = .restoring
        }
        await confirm()
    }

    /// Asks the API whose session this is. Offline keeps a cached user signed in.
    private func confirm() async {
        do {
            if let user = try await auth.currentSession() {
                await credentials.remember(user)
                state = .signedIn(user)
            } else {
                await credentials.clear()
                state = .signedOut
            }
        } catch {
            if state.user == nil {
                state = .restoreFailed(error.localizedDescription)
            }
        }
    }

    /// Signs in with email and password. Throws for the form to show; on success the state changes.
    func signIn(email: String, password: String) async throws(AuthError) {
        let user = try await auth.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
        await credentials.remember(user)
        state = .signedIn(user)
    }

    /// Signs out on the server when it can be reached, and on this device in any case.
    func signOut() async {
        try? await auth.signOut()
        await credentials.clear()
        state = .signedOut
    }
}
