import Foundation
import Testing
@testable import Mintsy

struct CookieJarTests {
    let api = URL(string: "http://localhost:4000/api/auth/sign-in/email")!
    let secureAPI = URL(string: "https://api.getmintsy.com/api/auth/sign-in/email")!
    let now = Date(timeIntervalSince1970: 1_800_000_000)

    @Test func keepsTheSessionCookieBetterAuthSets() {
        var jar = CookieJar()
        jar.apply(
            setCookie: "better-auth.session_token=abc.def%2B1; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax",
            from: api
        )
        // Max-Age counts from the real clock
        #expect(jar.hasSession())
        #expect(jar.header() == "better-auth.session_token=abc.def%2B1")
    }

    @Test func readsSeveralCookiesJoinedByCommas() {
        var jar = CookieJar()
        jar.apply(
            setCookie: "__Secure-better-auth.session_token=tok; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax, __Secure-better-auth.session_data=data; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax",
            from: secureAPI
        )
        #expect(jar.cookies.count == 2)
        #expect(jar.hasSession())
        #expect(jar.header() == "__Secure-better-auth.session_data=data; __Secure-better-auth.session_token=tok")
    }

    @Test func signOutsClearingCookieRemovesIt() {
        var jar = CookieJar(cookies: ["better-auth.session_token": StoredCookie(value: "abc", expires: nil)])
        jar.apply(setCookie: "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax", from: api, now: Date.now)
        #expect(!jar.hasSession())
        #expect(jar.header() == nil)
    }

    @Test func expiredCookiesAreNotSent() {
        let jar = CookieJar(cookies: [
            "better-auth.session_token": StoredCookie(value: "abc", expires: now.addingTimeInterval(-1)),
        ])
        #expect(!jar.hasSession(now: now))
        #expect(jar.header(now: now) == nil)
    }

    @Test func survivesARoundTripThroughJSON() throws {
        let jar = CookieJar(cookies: ["better-auth.session_token": StoredCookie(value: "abc", expires: now)])
        let decoded = try JSONDecoder().decode(CookieJar.self, from: JSONEncoder().encode(jar))
        #expect(decoded == jar)
    }
}
