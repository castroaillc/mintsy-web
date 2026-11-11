import Foundation
import Testing
@testable import Mintsy

struct AuthServiceTests {
    private func service(host: String) -> (AuthService, CredentialStore) {
        let credentials = CredentialStore(keychain: KeychainStore(service: "com.getmintsy.app.tests.\(host)"))
        let auth = AuthService(
            baseURL: URL(string: "http://\(host)/api/auth")!, origin: "mintsy-dev://",
            session: StubURLProtocol.session(), credentials: credentials
        )
        return (auth, credentials)
    }

    private let userJSON = #"{"id":"u1","email":"reader@example.com","name":"Riley","image":null,"emailVerified":true}"#

    @Test func signInSendsTheAppOriginAndStoresTheSessionCookie() async throws {
        let host = "auth-signin.test"
        StubURLProtocol.register(host: host) { _ in
            .init(
                headers: ["Content-Type": "application/json", "Set-Cookie": "better-auth.session_token=tok.sig; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax"],
                body: Data(#"{"redirect":false,"token":"tok","user":\#(userJSON)}"#.utf8)
            )
        }
        let (auth, credentials) = service(host: host)
        await credentials.clear()
        let user = try await auth.signIn(email: "reader@example.com", password: "secret")
        #expect(user.name == "Riley")
        #expect(await credentials.cookieHeader() == "better-auth.session_token=tok.sig")

        let request = try #require(StubURLProtocol.requests(for: host).first)
        #expect(request.url.path() == "/api/auth/sign-in/email")
        #expect(request.headers["Origin"] == "mintsy-dev://")
        #expect(request.headers["Cookie"] == nil)
        await credentials.clear()
    }

    @Test func wrongPasswordIsInvalidCredentials() async {
        let host = "auth-wrong.test"
        StubURLProtocol.register(host: host) { _ in
            .init(status: 401, body: Data(#"{"code":"INVALID_EMAIL_OR_PASSWORD","message":"Invalid email or password"}"#.utf8))
        }
        let (auth, _) = service(host: host)
        await #expect(throws: AuthError.invalidCredentials) {
            try await auth.signIn(email: "reader@example.com", password: "nope")
        }
    }

    @Test func getSessionReturnsNilForNull() async throws {
        let host = "auth-null.test"
        StubURLProtocol.register(host: host) { _ in .init(body: Data("null".utf8)) }
        let (auth, _) = service(host: host)
        #expect(try await auth.currentSession() == nil)
    }

    @Test func getSessionSendsTheStoredCookie() async throws {
        let host = "auth-session.test"
        StubURLProtocol.register(host: host) { _ in
            .init(body: Data(#"{"session":{"id":"s1"},"user":\#(userJSON)}"#.utf8))
        }
        let (auth, credentials) = service(host: host)
        await credentials.apply(setCookie: "better-auth.session_token=tok; Max-Age=600; Path=/", from: URL(string: "http://\(host)/api/auth")!)
        #expect(try await auth.currentSession()?.id == "u1")
        #expect(StubURLProtocol.requests(for: host).first?.headers["Cookie"] == "better-auth.session_token=tok")
        await credentials.clear()
    }
}
