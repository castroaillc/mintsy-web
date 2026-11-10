import Foundation

/// Better Auth's REST endpoints (backend `src/auth.ts`, mounted at `/api/auth`), as a native client calls them.
///
/// Better Auth checks the `Origin` of every POST that carries a cookie, and of any request that sends one, against
/// the API's trusted origins. The client sends `Origin: <scheme>://` itself: `mintsy://`, `mintsy-dev://` and
/// `mintsy-preview://` are already trusted, so no backend change is needed.
nonisolated struct AuthService: Sendable {
    let baseURL: URL
    let origin: String
    let session: URLSession
    let credentials: CredentialStore

    private struct SignInBody: Encodable {
        let email: String
        let password: String
    }

    private struct UserEnvelope: Decodable {
        let user: AuthUser
    }

    private struct ErrorBody: Decodable {
        let code: String?
        let message: String?
    }

    /// `POST /sign-in/email`. Stores the session cookie it sets and returns the user.
    func signIn(email: String, password: String) async throws(AuthError) -> AuthUser {
        let body: Data
        do {
            body = try JSONEncoder().encode(SignInBody(email: email, password: password))
        } catch {
            throw .decoding("Couldn't encode the request")
        }
        // No cookie: a fresh sign-in shouldn't carry an old session along
        let (data, _) = try await perform("sign-in/email", method: "POST", body: body, sendCookie: false)
        do {
            return try JSONDecoder().decode(UserEnvelope.self, from: data).user
        } catch {
            throw .decoding(String(describing: error))
        }
    }

    /// `GET /get-session`. The signed-in user, or nil when the API says there's no session (expired, revoked).
    func currentSession() async throws(AuthError) -> AuthUser? {
        let (data, _) = try await perform("get-session", method: "GET", body: nil, sendCookie: true)
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

    private func perform(_ path: String, method: String, body: Data?, sendCookie: Bool) async throws(AuthError) -> (Data, HTTPURLResponse) {
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
        // A refreshed or cleared session comes back in Set-Cookie, on errors too
        await credentials.apply(setCookie: http.value(forHTTPHeaderField: "Set-Cookie"), from: url)

        guard (200..<300).contains(http.statusCode) else {
            let error = try? JSONDecoder().decode(ErrorBody.self, from: data)
            if error?.code == "INVALID_EMAIL_OR_PASSWORD" { throw .invalidCredentials }
            throw .server(status: http.statusCode, code: error?.code, message: error?.message)
        }
        return (data, http)
    }
}
