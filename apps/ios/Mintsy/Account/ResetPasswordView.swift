import SwiftUI

/// Set a new password (design 47), opened by the reset email's link (`<scheme>://reset-password?token=…`), signed in
/// or out. The API revokes every session when it succeeds, so this signs straight back in when it knows the address
/// (the signed-in account, or the one a link was requested for on this phone) and otherwise goes to sign in.
struct ResetPasswordView: View {
    /// Nil when the link came back with an error (expired, used).
    let token: String?

    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var confirm = ""
    @State private var errorMessage: String?
    @State private var tokenRejected = false
    @State private var isSaving = false

    private var canSubmit: Bool {
        AccountRules.isValidPassword(password) && confirm == password && !isSaving
    }

    var body: some View {
        Group {
            if token == nil || tokenRejected {
                AuthScreen(title: "Link expired", subtitle: "This reset link is invalid, expired or was already used.") {
                    Text("Reset links work once, for an hour. Request a new one and open it from your latest email.")
                        .font(BrandFont.inter(15))
                        .foregroundStyle(Palette.mutedForeground)
                    Button("Close", action: close)
                        .buttonStyle(.brand(height: 54))
                        .padding(.top, 8)
                }
            } else {
                AuthScreen(title: "Set a new password", subtitle: subtitle) {
                    PasswordField(
                        label: "New password", text: $password, placeholder: "At least \(AccountRules.minPasswordLength) characters",
                        isNew: true, hint: "Use at least \(AccountRules.minPasswordLength) characters.",
                        error: AccountRules.newPasswordError(password), submitLabel: .next
                    )
                    PasswordField(
                        label: "Confirm new password", text: $confirm, placeholder: "Type it again", isNew: true,
                        error: AccountRules.confirmPasswordError(password, confirm), submitLabel: .go, onSubmit: submit
                    )
                    if let errorMessage {
                        FormErrorBanner(message: errorMessage)
                    }
                    SubmitButton(title: session.resetSignInEmail == nil ? "Update password" : "Save and sign in", isBusy: isSaving, action: submit)
                        .disabled(!canSubmit)
                        .padding(.top, 8)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel", action: close)
            }
        }
    }

    private var subtitle: String {
        if let email = session.resetSignInEmail {
            "For \(email). You’ll stay signed in on this phone; other devices are signed out."
        } else {
            "You’ll be signed out everywhere, then sign in with the new one."
        }
    }

    private func submit() {
        guard canSubmit, let token else { return }
        errorMessage = nil
        isSaving = true
        Task {
            do throws(AuthError) {
                try await session.resetPassword(token: token, newPassword: password)
                dismiss()
            } catch {
                if error.code == "INVALID_TOKEN" {
                    tokenRejected = true
                } else {
                    errorMessage = error.message(fallback: "We couldn’t reset your password. Try again.")
                }
            }
            isSaving = false
        }
    }

    private func close() {
        dismiss()
    }
}
