import Foundation
import Testing
@testable import Mintsy

struct DeepLinkTests {
    private func link(_ string: String, scheme: String = "mintsy-dev") -> DeepLink? {
        URL(string: string).flatMap { DeepLink(url: $0, scheme: scheme) }
    }

    @Test func readsTheResetLinkTheAPIRedirectsTo() {
        #expect(link("mintsy-dev://reset-password?token=IHHbih1e2axddqHmVBb9UCKX") == .resetPassword(token: "IHHbih1e2axddqHmVBb9UCKX", error: nil))
        #expect(link("mintsy-dev://reset-password/?token=abc") == .resetPassword(token: "abc", error: nil))
        #expect(link("mintsy-dev://reset-password?error=INVALID_TOKEN") == .resetPassword(token: nil, error: "INVALID_TOKEN"))
    }

    @Test func readsTheEmailChangedLink() {
        #expect(link("mintsy-dev://email-changed") == .emailChanged(error: nil))
        #expect(link("mintsy-dev://email-changed/?error=USER_NOT_FOUND") == .emailChanged(error: "USER_NOT_FOUND"))
    }

    @Test func ignoresOtherSchemesAndPaths() {
        #expect(link("mintsy://reset-password?token=abc") == nil)
        #expect(link("mintsy-dev://something-else") == nil)
        #expect(link("https://getmintsy.com/reset-password?token=abc") == nil)
        #expect(link("mintsy://reset-password?token=abc", scheme: "mintsy") == .resetPassword(token: "abc", error: nil))
    }

    @Test func theAuthServiceBuildsTheSameLinks() {
        let auth = AuthService(
            baseURL: URL(string: "http://x.test/api/auth")!, origin: "mintsy-preview://", session: .shared,
            credentials: CredentialStore(keychain: KeychainStore(service: "com.getmintsy.app.tests.links"))
        )
        #expect(auth.resetPasswordURL == "mintsy-preview://reset-password")
        #expect(auth.emailChangedURL == "mintsy-preview://email-changed")
    }
}
