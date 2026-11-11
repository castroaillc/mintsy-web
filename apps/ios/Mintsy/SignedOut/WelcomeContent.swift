import SwiftUI

/// Welcome's column: logo, any notice, the fan (when there's room for it), the pitch and the sign-in options.
struct WelcomeContent: View {
    let showsFan: Bool
    let onCreateAccount: () -> Void
    let onSignIn: () -> Void

    @Environment(SessionStore.self) private var session

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            WelcomeLogo()
                .padding(.top, 20)

            if let notice = session.notice {
                Button(action: session.clearNotice) {
                    FormErrorBanner(message: notice, tone: .success)
                }
                .buttonStyle(.plain)
                .accessibilityHint("Dismisses the message")
                .padding(.top, 16)
            }

            if showsFan {
                WelcomeFanArea()
                    .padding(.vertical, 16)
            } else {
                Spacer(minLength: 32)
            }

            WelcomePitch()

            VStack(spacing: 12) {
                SocialSignInSection()
                Button("Create account", action: onCreateAccount)
                    .buttonStyle(.brand(height: 54))
                Button("Sign in", action: onSignIn)
                    .buttonStyle(.brand(.outline, height: 54))
                LegalFootnote()
                    .padding(.top, 6)
            }
            .padding(.top, 24)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 16)
        .frame(maxWidth: 480)
        .frame(maxWidth: .infinity)
    }
}
