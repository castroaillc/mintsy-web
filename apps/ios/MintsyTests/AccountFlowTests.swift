import Foundation
import Testing
@testable import Mintsy

/// The Better Auth calls behind sign-up, password reset, account changes and deletion, against canned answers
/// shaped like the local API's (probed on 2026-11-10).
struct AccountFlowTests {
    private nonisolated static let userJSON = #"{"id":"u1","email":"reader@example.com","name":"Riley","emailVerified":false,"createdAt":"2026-11-10T16:55:55.533Z","updatedAt":"2026-11-10T16:55:55.533Z"}"#
    private nonisolated static let cookie = "better-auth.session_token=tok.sig; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax"

    private func make(host: String) -> (AuthService, CredentialStore, SessionStore) {
        let credentials = CredentialStore(keychain: KeychainStore(service: "com.getmintsy.app.tests.\(host)"))
        let auth = AuthService(
            baseURL: URL(string: "http://\(host)/api/auth")!, origin: "mintsy-dev://",
            session: StubURLProtocol.session(), credentials: credentials
        )
        return (auth, credentials, SessionStore(auth: auth, credentials: credentials))
    }

    private func json(_ data: Data?) throws -> [String: Any] {
        let body = try #require(data)
        return try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
    }

    @Test func signUpSendsNameEmailAndPasswordAndSignsIn() async throws {
        let host = "acct-signup.test"
        StubURLProtocol.register(host: host) { _ in
            .init(headers: ["Content-Type": "application/json", "Set-Cookie": Self.cookie], body: Data(#"{"token":"tok","user":\#(Self.userJSON)}"#.utf8))
        }
        let (_, credentials, session) = make(host: host)
        await credentials.clear()
        try await session.signUp(name: " Riley ", email: " reader@example.com", password: "password123")
        #expect(session.state.user?.id == "u1")
        #expect(session.state.user?.memberSince != nil)
        #expect(await credentials.cookieHeader() == "better-auth.session_token=tok.sig")

        let request = try #require(StubURLProtocol.requests(for: host).first)
        #expect(request.url.path() == "/api/auth/sign-up/email")
        #expect(request.headers["Cookie"] == nil)
        let body = try json(request.body)
        #expect(body["name"] as? String == "Riley")
        #expect(body["email"] as? String == "reader@example.com")
        await credentials.clear()
    }

    @Test func aTakenEmailReadsAsInUse() async {
        let host = "acct-taken.test"
        StubURLProtocol.register(host: host) { _ in
            .init(status: 422, body: Data(#"{"message":"User already exists. Use another email.","code":"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"}"#.utf8))
        }
        let (_, _, session) = make(host: host)
        do throws(AuthError) {
            try await session.signUp(name: "R", email: "reader@example.com", password: "password123")
            Issue.record("Expected an error")
        } catch {
            #expect(error.message(fallback: "x") == "That email is already in use.")
        }
    }

    @Test func passwordResetAsksForALinkBackIntoThisBuild() async throws {
        let host = "acct-reset-request.test"
        StubURLProtocol.register(host: host) { _ in
            .init(body: Data(#"{"status":true,"message":"If this email exists in our system, check your email for the reset link"}"#.utf8))
        }
        let (_, _, session) = make(host: host)
        try await session.requestPasswordReset(email: " reader@example.com ")
        let body = try json(StubURLProtocol.requests(for: host).first?.body)
        #expect(body["email"] as? String == "reader@example.com")
        #expect(body["redirectTo"] as? String == "mintsy-dev://reset-password")
        #expect(session.resetSignInEmail == "reader@example.com")
    }

    @Test func resettingSignsStraightBackInWhenTheEmailIsKnown() async throws {
        let host = "acct-reset.test"
        StubURLProtocol.register(host: host) { seen in
            switch seen.url.path() {
            case "/api/auth/reset-password": .init(body: Data(#"{"status":true}"#.utf8))
            case "/api/auth/sign-in/email":
                .init(headers: ["Content-Type": "application/json", "Set-Cookie": Self.cookie], body: Data(#"{"redirect":false,"token":"tok","user":\#(Self.userJSON)}"#.utf8))
            default: .init(body: Data(#"{"status":true}"#.utf8))
            }
        }
        let (_, credentials, session) = make(host: host)
        try await session.requestPasswordReset(email: "reader@example.com")
        try await session.resetPassword(token: "t0k", newPassword: "newpassword1")
        #expect(session.state.user?.id == "u1")
        let paths = StubURLProtocol.requests(for: host).map { $0.url.path() }
        #expect(paths == ["/api/auth/request-password-reset", "/api/auth/reset-password", "/api/auth/sign-in/email"])
        let reset = try json(StubURLProtocol.requests(for: host)[1].body)
        #expect(reset["token"] as? String == "t0k" && reset["newPassword"] as? String == "newpassword1")
        let signIn = try json(StubURLProtocol.requests(for: host)[2].body)
        #expect(signIn["password"] as? String == "newpassword1")
        await credentials.clear()
    }

    @Test func resettingWithoutAKnownEmailLeavesANoteForSignIn() async throws {
        let host = "acct-reset-unknown.test"
        StubURLProtocol.register(host: host) { _ in .init(body: Data(#"{"status":true}"#.utf8)) }
        let (_, _, session) = make(host: host)
        try await session.resetPassword(token: "t0k", newPassword: "newpassword1")
        #expect(session.state == .signedOut)
        #expect(session.notice == "Password updated. Sign in with your new password.")
        #expect(StubURLProtocol.requests(for: host).count == 1)
    }

    @Test func anExpiredResetTokenIsReported() async {
        let host = "acct-reset-expired.test"
        StubURLProtocol.register(host: host) { _ in .init(status: 400, body: Data(#"{"message":"Invalid token","code":"INVALID_TOKEN"}"#.utf8)) }
        let (_, _, session) = make(host: host)
        await #expect(throws: AuthError.server(status: 400, code: "INVALID_TOKEN", message: "Invalid token")) {
            try await session.resetPassword(token: "old", newPassword: "newpassword1")
        }
    }

    @Test func changingPasswordStoresTheReplacementSessionCookie() async throws {
        let host = "acct-change-password.test"
        StubURLProtocol.register(host: host) { _ in
            .init(
                headers: ["Content-Type": "application/json", "Set-Cookie": "better-auth.session_token=new.sig; Max-Age=604800; Path=/"],
                body: Data(#"{"token":"new","user":\#(Self.userJSON)}"#.utf8)
            )
        }
        let (_, credentials, session) = make(host: host)
        await credentials.apply(setCookie: "better-auth.session_token=old.sig; Max-Age=600; Path=/", from: URL(string: "http://\(host)/api/auth")!)
        try await session.changePassword(current: "password123", new: "password456", signOutOthers: true)
        let request = try #require(StubURLProtocol.requests(for: host).first)
        #expect(request.headers["Cookie"] == "better-auth.session_token=old.sig")
        #expect(request.headers["Origin"] == "mintsy-dev://")
        let body = try json(request.body)
        #expect(body["revokeOtherSessions"] as? Bool == true)
        #expect(await credentials.cookieHeader() == "better-auth.session_token=new.sig")
        await credentials.clear()
    }

    @Test func changeEmailSendsTheConfirmationLinkBackIntoTheApp() async throws {
        let host = "acct-change-email.test"
        StubURLProtocol.register(host: host) { seen in
            seen.url.path().hasSuffix("get-session")
                ? .init(body: Data(#"{"session":{"id":"s"},"user":\#(Self.userJSON)}"#.utf8))
                : .init(body: Data(#"{"status":true}"#.utf8))
        }
        let (_, _, session) = make(host: host)
        let changedNow = try await session.changeEmail(to: "new@example.com")
        #expect(!changedNow)
        let body = try json(StubURLProtocol.requests(for: host).first?.body)
        #expect(body["newEmail"] as? String == "new@example.com")
        #expect(body["callbackURL"] as? String == "mintsy-dev://email-changed")
    }

    @Test func deletingWithAPasswordSendsItAndSignsOut() async throws {
        let host = "acct-delete.test"
        StubURLProtocol.register(host: host) { _ in
            .init(
                headers: ["Content-Type": "application/json", "Set-Cookie": "better-auth.session_token=; Max-Age=0; Path=/"],
                body: Data(#"{"success":true,"message":"User deleted"}"#.utf8)
            )
        }
        let (_, credentials, session) = make(host: host)
        await credentials.apply(setCookie: Self.cookie, from: URL(string: "http://\(host)/api/auth")!)
        try await session.deleteAccount(password: "password123")
        #expect(session.state == .signedOut)
        #expect(session.notice?.hasPrefix("Your account has been deleted") == true)
        #expect(await credentials.cookieHeader() == nil)
        #expect(try json(StubURLProtocol.requests(for: host).first?.body)["password"] as? String == "password123")
    }

    @Test func deletingWithoutAPasswordLeavesTheFieldOut() async throws {
        let host = "acct-delete-social.test"
        StubURLProtocol.register(host: host) { _ in
            .init(status: 403, body: Data(#"{"message":"Sign in again to delete your account","code":"REAUTH_REQUIRED"}"#.utf8))
        }
        let (auth, _, _) = make(host: host)
        await #expect(throws: AuthError.server(status: 403, code: "REAUTH_REQUIRED", message: "Sign in again to delete your account")) {
            try await auth.deleteUser(password: nil)
        }
        let body = try json(StubURLProtocol.requests(for: host).first?.body)
        #expect(body.isEmpty)
    }

    @Test func listAccountsTellsPasswordAndAppleApart() async throws {
        let host = "acct-list.test"
        StubURLProtocol.register(host: host) { _ in
            .init(body: Data(#"[{"accountId":"x","providerId":"apple","userId":"u1","id":"a","scopes":[]}]"#.utf8))
        }
        let (auth, _, _) = make(host: host)
        let methods = try await auth.signInMethods()
        #expect(methods == SignInMethods(hasPassword: false, socialProvider: "apple"))
    }

    @Test func appleSignInPostsTheIDTokenRawNonceAndFirstName() async throws {
        let host = "acct-apple.test"
        StubURLProtocol.register(host: host) { _ in
            .init(headers: ["Content-Type": "application/json", "Set-Cookie": Self.cookie], body: Data(#"{"redirect":false,"token":"tok","user":\#(Self.userJSON)}"#.utf8))
        }
        let (_, credentials, session) = make(host: host)
        let user = try await session.signInWithApple(AppleIDToken(token: "jwt", nonce: "raw", givenName: "Riley", familyName: nil))
        #expect(user.id == "u1")
        let body = try json(StubURLProtocol.requests(for: host).first?.body)
        #expect(body["provider"] as? String == "apple")
        let idToken = try #require(body["idToken"] as? [String: Any])
        #expect(idToken["token"] as? String == "jwt")
        #expect(idToken["nonce"] as? String == "raw")
        let name = (idToken["user"] as? [String: Any])?["name"] as? [String: Any]
        #expect(name?["firstName"] as? String == "Riley")
        #expect(name?["lastName"] == nil)
        await credentials.clear()
    }

    @Test func appleSignInWithoutANameSendsNoUser() async throws {
        let host = "acct-apple-noname.test"
        StubURLProtocol.register(host: host) { _ in
            .init(status: 401, body: Data(#"{"message":"Invalid token","code":"INVALID_TOKEN"}"#.utf8))
        }
        let (auth, _, _) = make(host: host)
        await #expect(throws: AuthError.self) {
            try await auth.signInWithApple(AppleIDToken(token: "jwt", nonce: "raw", givenName: nil, familyName: nil))
        }
        let idToken = try #require(try json(StubURLProtocol.requests(for: host).first?.body)["idToken"] as? [String: Any])
        #expect(idToken["user"] == nil)
    }
}
