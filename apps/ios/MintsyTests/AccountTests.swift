import Foundation
import Testing
@testable import Mintsy

struct AccountTests {
    @Test func passwordRulesMatchBetterAuthsMinimum() {
        #expect(AccountRules.newPasswordError("") == nil)
        #expect(AccountRules.newPasswordError("short") == "Use at least 8 characters.")
        #expect(AccountRules.newPasswordError("long enough") == nil)
        #expect(AccountRules.isValidPassword("12345678"))
        #expect(!AccountRules.isValidPassword("1234567"))
        #expect(AccountRules.confirmPasswordError("password1", "") == nil)
        #expect(AccountRules.confirmPasswordError("password1", "password2") == "Passwords don’t match.")
        #expect(AccountRules.confirmPasswordError("password1", "password1") == nil)
    }

    @Test(arguments: [
        ("you@example.com", true), ("  you@example.com ", true), ("you@example", false),
        ("you example@x.com", false), ("@example.com", false), ("", false),
    ])
    func emailCheck(email: String, valid: Bool) {
        #expect(AccountRules.isValidEmail(email) == valid)
    }

    @Test func sameEmailIgnoresCaseAndSpaces() {
        #expect(AccountRules.isSameEmail(" You@Example.com", "you@example.com"))
        #expect(!AccountRules.isSameEmail("you@example.com", "me@example.com"))
    }

    @Test func authErrorsReadAsTheExpoAppWordedThem() {
        let taken = AuthError.server(status: 422, code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", message: "User already exists. Use another email.")
        #expect(taken.message(fallback: "x") == "That email is already in use.")
        let unknown = AuthError.server(status: 500, code: "SOMETHING_NEW", message: "Internal detail")
        #expect(unknown.message(fallback: "We couldn’t do that.") == "We couldn’t do that.")
        #expect(AuthError.invalidCredentials.message(fallback: "x").hasPrefix("That email and password don’t match"))
        #expect(AuthError.network(.notConnectedToInternet).message(fallback: "x").hasPrefix("You're offline"))
        #expect(taken.code == "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")
    }

    @Test func signInMethodsFromLinkedAccounts() {
        let password = SignInMethods(providerIDs: ["credential"])
        #expect(password.hasPassword && !password.isSocialOnly && password.socialProvider == nil)
        let apple = SignInMethods(providerIDs: ["apple"])
        #expect(apple.isSocialOnly && apple.providerName == "Apple")
        let both = SignInMethods(providerIDs: ["apple", "credential"])
        #expect(both.hasPassword && both.socialProvider == "apple")
        #expect(SignInMethods.assumed.hasPassword)
    }

    @Test func appleNonceIsRandomHexAndHashesWithSHA256() {
        let a = AppleNonce.make()
        let b = AppleNonce.make()
        #expect(a != b)
        #expect(a.count == 64)
        #expect(AppleNonce.sha256("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    }

    @Test func readsTheAPIsTimestamps() throws {
        let withFraction = try #require(ISODate.parse("2026-11-10T16:55:55.533Z"))
        let without = try #require(ISODate.parse("2026-11-10T16:55:55Z"))
        #expect(withFraction.timeIntervalSince(without) > 0.5 && withFraction.timeIntervalSince(without) < 0.6)
        #expect(ISODate.parse("yesterday") == nil)
        let user = AuthUser(id: "u", email: "e", name: "n", image: nil, createdAt: "2026-11-10T16:55:55.533Z")
        #expect(user.memberSince != nil)
    }

    @Test func aStoredUserWithoutCreatedAtStillDecodes() throws {
        let user = try JSONDecoder().decode(AuthUser.self, from: Data(#"{"id":"u","email":"e@x.com","name":"N","image":null}"#.utf8))
        #expect(user.createdAt == nil && user.memberSince == nil)
    }

    @Test func emailChangeErrorsHaveWords() {
        #expect(EmailChangeOutcome.message(for: "user_not_found") == "This confirmation link was already used.")
        #expect(EmailChangeOutcome.message(for: "WHATEVER") == "We couldn’t confirm your new email.")
    }
}
