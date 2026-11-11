import Foundation

/// The cookies Better Auth set, by name: what `@better-auth/expo` keeps in SecureStore as `mintsy_cookie`.
/// The session cookie is `better-auth.session_token` on http and `__Secure-better-auth.session_token` on https.
nonisolated struct CookieJar: Codable, Equatable, Sendable {
    private(set) var cookies: [String: StoredCookie] = [:]

    init(cookies: [String: StoredCookie] = [:]) {
        self.cookies = cookies
    }

    /// Takes in a response's `Set-Cookie` header (several cookies may be joined by commas). A cookie set to an
    /// empty value or an expiry in the past (`Max-Age=0`, how sign-out clears it) is removed.
    mutating func apply(setCookie header: String?, from url: URL, now: Date = .now) {
        guard let header, !header.isEmpty else { return }
        for cookie in HTTPCookie.cookies(withResponseHeaderFields: ["Set-Cookie": header], for: url) {
            let stored = StoredCookie(value: cookie.value, expires: cookie.expiresDate)
            cookies[cookie.name] = stored.isLive(at: now) ? stored : nil
        }
    }

    /// The `Cookie` request header: every cookie that hasn't expired. Nil when there are none.
    func header(now: Date = .now) -> String? {
        let live = cookies
            .filter { $0.value.isLive(at: now) }
            .sorted { $0.key < $1.key }
            .map { "\($0.key)=\($0.value.value)" }
        return live.isEmpty ? nil : live.joined(separator: "; ")
    }

    /// Whether the jar holds a session token that hasn't expired. Without one the API can only answer "signed out".
    func hasSession(now: Date = .now) -> Bool {
        cookies.contains { name, cookie in name.contains("session_token") && cookie.isLive(at: now) }
    }
}
