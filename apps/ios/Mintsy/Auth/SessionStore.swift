import Foundation
import Observation

/// The viewer's Better Auth session: restored from the Keychain on launch, then confirmed with the API. Every account
/// flow that changes who's signed in goes through here, so `state` is the one source of truth for the root view.
@Observable
final class SessionStore {
    private(set) var state: SessionState = .restoring
    /// A one-off message for the signed-out screens ("Your account has been deleted", "Password updated").
    private(set) var notice: String?
    /// How the signed-in user signs in. Assumed to include a password until `loadSignInMethods` says otherwise.
    private(set) var signInMethods = SignInMethods.assumed
    private(set) var signInMethodsLoaded = false

    @ObservationIgnored private let auth: AuthService
    @ObservationIgnored private let credentials: CredentialStore
    /// The address a reset link was last requested for on this device, so the reset can sign straight back in.
    @ObservationIgnored private(set) var resetEmail: String?

    init(auth: AuthService, credentials: CredentialStore) {
        self.auth = auth
        self.credentials = credentials
    }

    // MARK: Launch

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

    /// Re-reads the user from the API (a new name or email). Throws when the API can't be reached.
    func refreshUser() async throws(AuthError) {
        if let user = try await auth.currentSession() {
            await credentials.remember(user)
            state = .signedIn(user)
        } else if state.user != nil {
            await credentials.clear()
            state = .signedOut
        }
    }

    // MARK: Signing in and out

    /// Signs in with email and password. Throws for the form to show; on success the state changes.
    func signIn(email: String, password: String) async throws(AuthError) {
        let user = try await auth.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
        await signedIn(user)
    }

    /// Creates an account and signs it in.
    func signUp(name: String, email: String, password: String) async throws(AuthError) {
        let user = try await auth.signUp(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            email: email.trimmingCharacters(in: .whitespacesAndNewlines),
            password: password
        )
        await signedIn(user)
    }

    /// Signs in (or up) with Apple's ID token. Returns the user, so a re-authentication can check it's the same one.
    @discardableResult
    func signInWithApple(_ token: AppleIDToken) async throws(AuthError) -> AuthUser {
        let user = try await auth.signInWithApple(token)
        await signedIn(user)
        return user
    }

    private func signedIn(_ user: AuthUser) async {
        await credentials.remember(user)
        notice = nil
        if state.user?.id != user.id { forgetSignInMethods() }
        state = .signedIn(user)
    }

    /// Signs out on the server when it can be reached, and on this device in any case.
    func signOut(notice: String? = nil) async {
        try? await auth.signOut()
        await forget(notice: notice)
    }

    /// Clears this device's session. The server's is already gone (or unreachable).
    private func forget(notice: String?) async {
        await credentials.clear()
        self.notice = notice
        forgetSignInMethods()
        state = .signedOut
    }

    private func forgetSignInMethods() {
        signInMethods = .assumed
        signInMethodsLoaded = false
    }

    func clearNotice() {
        notice = nil
    }

    // MARK: Passwords

    /// Emails a reset link. The API answers the same whether or not the address has an account.
    func requestPasswordReset(email: String) async throws(AuthError) {
        let address = email.trimmingCharacters(in: .whitespacesAndNewlines)
        try await auth.requestPasswordReset(email: address)
        resetEmail = address
    }

    /// The address a reset will sign back in with: the signed-in user's, or the one a link was requested for here.
    var resetSignInEmail: String? { state.user?.email ?? resetEmail }

    /// Sets a new password from an emailed token. The API then revokes every session, this device's too, so this
    /// signs straight back in when it knows the address, and otherwise leaves a note for the sign-in screen.
    func resetPassword(token: String, newPassword: String) async throws(AuthError) {
        let email = resetSignInEmail
        try await auth.resetPassword(token: token, newPassword: newPassword)
        resetEmail = nil
        await credentials.clear()
        if let email, let user = try? await auth.signIn(email: email, password: newPassword) {
            await signedIn(user)
        } else {
            notice = "Password updated. Sign in with your new password."
            forgetSignInMethods()
            state = .signedOut
        }
    }

    /// Changes the password; with `signOutOthers`, every other device is signed out.
    func changePassword(current: String, new: String, signOutOthers: Bool) async throws(AuthError) {
        try await auth.changePassword(current: current, new: new, revokeOtherSessions: signOutOthers)
    }

    // MARK: Account

    func updateName(_ name: String) async throws(AuthError) {
        try await auth.updateName(name.trimmingCharacters(in: .whitespacesAndNewlines))
        try await refreshUser()
    }

    /// Starts an email change. True when the API changed it at once; false when it's waiting for the link.
    func changeEmail(to newEmail: String) async throws(AuthError) -> Bool {
        let address = newEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        try await auth.changeEmail(to: address)
        try? await refreshUser()
        return state.user.map { AccountRules.isSameEmail($0.email, address) } ?? false
    }

    /// Reads which sign-in methods the account has (once per user). On failure the password is still assumed.
    func loadSignInMethods() async {
        guard state.user != nil, !signInMethodsLoaded else { return }
        if let methods = try? await auth.signInMethods() {
            signInMethods = methods
            signInMethodsLoaded = true
        }
    }

    /// Deletes the account on the server, then everything about it on this device.
    func deleteAccount(password: String?) async throws(AuthError) {
        try await auth.deleteUser(password: password)
        await forget(notice: "Your account has been deleted. Thanks for learning with mintsy.")
    }
}
