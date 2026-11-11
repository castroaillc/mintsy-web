import SwiftUI

/// "Check your email" after a reset link is sent (design 46): open the mail app, resend (with a short cooldown),
/// or go back to sign in.
struct CheckEmailView: View {
    static let resendCooldown: Duration = .seconds(30)

    let email: String
    let onResend: () async -> Bool
    let onUseAnotherEmail: () -> Void
    let onBackToSignIn: () -> Void

    @Environment(\.openURL) private var openURL
    @State private var isResending = false
    @State private var resentAt: ContinuousClock.Instant?
    @State private var mailUnavailable = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Image(systemName: "envelope.open")
                    .font(.system(size: 32))
                    .foregroundStyle(Palette.brand)
                    .frame(width: 88, height: 88)
                    .background(Palette.card, in: .circle)
                    .overlay { Circle().strokeBorder(Palette.border) }
                    .accessibilityHidden(true)
                Text("Check your email")
                    .font(BrandFont.display(30, relativeTo: .largeTitle))
                    .foregroundStyle(Palette.foreground)
                    .accessibilityAddTraits(.isHeader)
                    .padding(.top, 6)
                Text("If an account exists for **\(email)**, we’ve sent it a link to reset your password. It expires in 1 hour.")
                    .font(BrandFont.inter(16))
                    .foregroundStyle(Palette.mutedForeground)
                Text("Open it on this iPhone. Don’t see it? Check spam, or make sure you used the email you signed up with.")
                    .font(BrandFont.inter(14, relativeTo: .subheadline))
                    .foregroundStyle(Palette.faint)

                VStack(spacing: 10) {
                    if !mailUnavailable {
                        Button("Open email app", action: openMail)
                            .buttonStyle(.brand(height: 54))
                    }
                    ResendButton(isResending: isResending, resentAt: resentAt, cooldown: Self.resendCooldown, action: resend)
                    Button("Use a different email", action: onUseAnotherEmail)
                        .buttonStyle(.brand(.outline, height: 48))
                    Button("Back to sign in", action: onBackToSignIn)
                        .font(BrandFont.inter(15, .medium, relativeTo: .subheadline))
                        .foregroundStyle(Palette.mutedForeground)
                        .frame(minHeight: Metrics.minTap)
                }
                .padding(.top, 24)
            }
            .multilineTextAlignment(.center)
            .padding(.horizontal, 24)
            .padding(.vertical, 32)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .background(Palette.background)
    }

    private func openMail() {
        guard let url = URL(string: "message://") else { return }
        openURL(url) { accepted in
            if !accepted { mailUnavailable = true }
        }
    }

    private func resend() {
        isResending = true
        Task {
            if await onResend() { resentAt = .now }
            isResending = false
        }
    }
}
