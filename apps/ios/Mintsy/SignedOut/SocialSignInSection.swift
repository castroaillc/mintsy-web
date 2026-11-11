import SwiftUI

/// Sign in with Apple, then "or" before the email options. Errors show under the button; success changes the
/// session, and the root view moves on.
struct SocialSignInSection: View {
    @Environment(SessionStore.self) private var session
    @State private var errorMessage: String?
    @State private var isSigningIn = false

    var body: some View {
        VStack(spacing: 12) {
            AppleSignInButton(onToken: signIn, onFailure: show)
                .disabled(isSigningIn)
                .opacity(isSigningIn ? 0.5 : 1)
                .overlay {
                    if isSigningIn { ProgressView().tint(Palette.background) }
                }
            if let errorMessage {
                FormErrorBanner(message: errorMessage)
            }
            OrDivider()
        }
    }

    private func signIn(_ token: AppleIDToken) {
        errorMessage = nil
        isSigningIn = true
        Task {
            do throws(AuthError) {
                try await session.signInWithApple(token)
            } catch {
                errorMessage = error.message(fallback: "We couldn’t sign you in. Try again.")
            }
            isSigningIn = false
        }
    }

    private func show(_ message: String) {
        errorMessage = message
    }
}
