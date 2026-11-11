import Foundation

/// Better Auth's REST endpoints (backend `src/auth.ts`, mounted at `/api/auth`), as a native client calls them.
///
/// Better Auth checks the `Origin` of every POST that carries a cookie, and of any request that sends one, against
/// the API's trusted origins. The client sends `Origin: <scheme>://` itself: `mintsy://`, `mintsy-dev://` and
/// `mintsy-preview://` are already trusted, so no backend change is needed. The same origin is the start of the
/// links email flows come back on (`<scheme>://reset-password`, `<scheme>://email-changed`).
nonisolated struct AuthService: Sendable {
    let baseURL: URL
    let origin: String
    let session: URLSession
    let credentials: CredentialStore

    /// Where the reset email's link lands: Better Auth redirects to it with `?token=` (or `?error=`).
    var resetPasswordURL: String { origin + DeepLink.resetPasswordHost }
    /// Where the change-email confirmation lands, with `?error=` when it failed.
    var emailChangedURL: String { origin + DeepLink.emailChangedHost }

    private struct SignInBody: Encodable {
        let email: String
        let password: String
    }

    private struct SignUpBody: Encodable {
        let name: String
        let email: String
        let password: String
    }

    private struct ResetRequestBody: Encodable {
        let email: String
        let redirectTo: String
    }

    private struct ResetBody: Encodable {
        let newPassword: String
        let token: String
    }

    private struct NameBody: Encodable {
        let name: String
    }

    private struct ChangeEmailBody: Encodable {
        let newEmail: String
        let callbackURL: String
    }

    private struct ChangePasswordBody: Encodable {
        let currentPassword: String
        let newPassword: String
        let revokeOtherSessions: Bool
    }

    private struct DeleteBody: Encodable {
        /// Left out entirely for accounts without a password (sending one gives CREDENTIAL_ACCOUNT_NOT_FOUND).
        let password: String?
    }

    private struct SocialBody: Encodable {
        struct IDToken: Encodable {
            struct User: Encodable {
                struct Name: Encodable {
                    let firstName: String?
                    let lastName: String?
                }
                let name: Name
            }
            let token: String
            let nonce: String
            let user: User?
        }
        let provider: String
        let idToken: IDToken
    }

    private struct UserEnvelope: Decodable {
        let user: AuthUser
    }

    private struct Account: Decodable {
        let providerId: String
    }

    private struct ErrorBody: Decodable {
        let code: String?
        let message: String?
    }

    // MARK: Signing in and out

    /// `POST /sign-in/email`. Stores the session cookie it sets and returns the user.
    func signIn(email: String, password: String) async throws(AuthError) -> AuthUser {
        // No cookie: a fresh sign-in shouldn't carry an old session along
        let data = try await post("sign-in/email", SignInBody(email: email, password: password), sendCookie: false)
        return try decodeUser(data)
    }

    /// `POST /sign-up/email`. Creates the account and signs it in (the API doesn't ask to verify the email first).
    func signUp(name: String, email: String, password: String) async throws(AuthError) -> AuthUser {
        let data = try await post("sign-up/email", SignUpBody(name: name, email: email, password: password), sendCookie: false)
        return try decodeUser(data)
    }

    /// `POST /sign-in/social` with Apple's ID token: the same session as email sign-in, with no browser redirect.
    func signInWithApple(_ token: AppleIDToken) async throws(AuthError) -> AuthUser {
        let hasName = token.givenName != nil || token.familyName != nil
        let user = hasName ? SocialBody.IDToken.User(name: .init(firstName: token.givenName, lastName: token.familyName)) : nil
        let body = SocialBody(provider: "apple", idToken: .init(token: token.token, nonce: token.nonce, user: user))
        let data = try await post("sign-in/social", body, sendCookie: false)
        return try decodeUser(data)
    }

    /// `GET /get-session`. The signed-in user, or nil when the API says there's no session (expired, revoked).
    func currentSession() async throws(AuthError) -> AuthUser? {
        let data = try await perform("get-session", method: "GET", body: nil, sendCookie: true)
        // `null` when there's no session
        do {
            return try JSONDecoder().decode(UserEnvelope?.self, from: data)?.user
        } catch {
            throw .decoding("Unexpected get-session response: \(error)")
        }
    }

    /// `POST /sign-out`: revokes the session on the server.
    func signOut() async throws(AuthError) {
        _ = try await perform("sign-out", method: "POST", body: Data("{}".utf8), sendCookie: true)
    }

    // MARK: Passwords

    /// `POST /request-password-reset`. Answers the same whether or not the email has an account.
    func requestPasswordReset(email: String) async throws(AuthError) {
        _ = try await post("request-password-reset", ResetRequestBody(email: email, redirectTo: resetPasswordURL), sendCookie: false)
    }

    /// `POST /reset-password` with the emailed token. Revokes every session of that account.
    func resetPassword(token: String, newPassword: String) async throws(AuthError) {
        _ = try await post("reset-password", ResetBody(newPassword: newPassword, token: token), sendCookie: false)
    }

    /// `POST /change-password`. With `revokeOtherSessions` the API replaces this device's session too, and the new
    /// cookie comes back in Set-Cookie.
    func changePassword(current: String, new: String, revokeOtherSessions: Bool) async throws(AuthError) {
        let body = ChangePasswordBody(currentPassword: current, newPassword: new, revokeOtherSessions: revokeOtherSessions)
        _ = try await post("change-password", body, sendCookie: true)
    }

    // MARK: Account

    /// `POST /update-user`.
    func updateName(_ name: String) async throws(AuthError) {
        _ = try await post("update-user", NameBody(name: name), sendCookie: true)
    }

    /// `POST /change-email`. Better Auth emails a confirmation link to the new address; the stored email changes
    /// only when it's opened.
    func changeEmail(to newEmail: String) async throws(AuthError) {
        _ = try await post("change-email", ChangeEmailBody(newEmail: newEmail, callbackURL: emailChangedURL), sendCookie: true)
    }

    /// `GET /list-accounts`: which sign-in methods the user has.
    func signInMethods() async throws(AuthError) -> SignInMethods {
        let data = try await perform("list-accounts", method: "GET", body: nil, sendCookie: true)
        do {
            let accounts = try JSONDecoder().decode([Account].self, from: data)
            return SignInMethods(providerIDs: accounts.map(\.providerId))
        } catch {
            throw .decoding(String(describing: error))
        }
    }

    /// `POST /delete-user`: deletes the account and everything the API keeps about it, at once.
    func deleteUser(password: String?) async throws(AuthError) {
        _ = try await post("delete-user", DeleteBody(password: password), sendCookie: true)
    }

    // MARK: Requests

    private func decodeUser(_ data: Data) throws(AuthError) -> AuthUser {
        do {
            return try JSONDecoder().decode(UserEnvelope.self, from: data).user
        } catch {
            throw .decoding(String(describing: error))
        }
    }

    private func post(_ path: String, _ body: some Encodable, sendCookie: Bool) async throws(AuthError) -> Data {
        let encoded: Data
        do {
            encoded = try JSONEncoder().encode(body)
        } catch {
            throw .decoding("Couldn't encode the request")
        }
        return try await perform(path, method: "POST", body: encoded, sendCookie: sendCookie)
    }

    private func perform(_ path: String, method: String, body: Data?, sendCookie: Bool) async throws(AuthError) -> Data {
        let url = baseURL.appending(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        request.setValue(origin, forHTTPHeaderField: "Origin")
        if sendCookie, let cookie = await credentials.cookieHeader() {
            request.setValue(cookie, forHTTPHeaderField: "Cookie")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError {
            throw .network(error.code)
        } catch {
            throw .network(.unknown)
        }
        guard let http = response as? HTTPURLResponse else { throw .decoding("Not an HTTP response") }
        // A new, refreshed or cleared session comes back in Set-Cookie, on errors too
        await credentials.apply(setCookie: http.value(forHTTPHeaderField: "Set-Cookie"), from: url)

        guard (200..<300).contains(http.statusCode) else {
            let error = try? JSONDecoder().decode(ErrorBody.self, from: data)
            if error?.code == "INVALID_EMAIL_OR_PASSWORD" { throw .invalidCredentials }
            throw .server(status: http.statusCode, code: error?.code, message: error?.message)
        }
        return data
    }
}
