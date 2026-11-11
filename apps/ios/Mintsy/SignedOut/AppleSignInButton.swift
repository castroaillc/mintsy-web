import AuthenticationServices
import SwiftUI

/// Apple's own Sign in with Apple button (App Store guideline 4.8), handing back an ID token with its raw nonce.
/// Cancelling the sheet reports nothing.
struct AppleSignInButton: View {
    var label: SignInWithAppleButton.Label = .continue
    let onToken: (AppleIDToken) -> Void
    let onFailure: (String) -> Void

    @State private var nonce = ""

    var body: some View {
        SignInWithAppleButton(label, onRequest: configure, onCompletion: complete)
            .signInWithAppleButtonStyle(.white)
            .frame(height: 54)
            .clipShape(.rect(cornerRadius: 14))
    }

    private func configure(_ request: ASAuthorizationAppleIDRequest) {
        nonce = AppleNonce.make()
        request.requestedScopes = [.fullName, .email]
        request.nonce = AppleNonce.sha256(nonce)
    }

    private func complete(_ result: Result<ASAuthorization, any Error>) {
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let data = credential.identityToken, let token = String(data: data, encoding: .utf8) else {
                onFailure("We couldn’t sign you in. Try again.")
                return
            }
            onToken(AppleIDToken(
                token: token, nonce: nonce,
                givenName: Self.clean(credential.fullName?.givenName),
                familyName: Self.clean(credential.fullName?.familyName)
            ))
        case .failure(let error):
            if (error as? ASAuthorizationError)?.code == .canceled { return }
            onFailure("We couldn’t sign you in with Apple. Try again.")
        }
    }

    private static func clean(_ name: String?) -> String? {
        let trimmed = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }
}
