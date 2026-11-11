import SwiftUI

/// Change password (design 48, Expo `profile/change-password.tsx`): the current one, a new one twice, and whether to
/// sign out other devices. "Forgot it?" emails a reset link to the account's address.
struct ChangePasswordView: View {
    let user: AuthUser

    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var current = ""
    @State private var password = ""
    @State private var confirm = ""
    @State private var signOutOthers = true
    @State private var currentError: String?
    @State private var errorMessage: String?
    @State private var isSaving = false
    @State private var isSendingReset = false
    @State private var resetNotice: String?
    @State private var didChange = false

    private var canSubmit: Bool {
        !current.isEmpty && AccountRules.isValidPassword(password) && confirm == password && !isSaving
    }

    var body: some View {
        AuthScreen(title: "Change password", subtitle: "Use at least \(AccountRules.minPasswordLength) characters.") {
            PasswordField(label: "Current password", text: $current, placeholder: "Your current password", error: currentError, submitLabel: .next) {
                Button("Forgot it?", action: sendResetLink)
                    .font(BrandFont.inter(14, .medium, relativeTo: .subheadline))
                    .foregroundStyle(Palette.brand)
                    .frame(minHeight: Metrics.minTap)
                    .disabled(isSendingReset)
                    .accessibilityLabel("Forgot your current password? Email me a reset link")
            }
            PasswordField(
                label: "New password", text: $password, placeholder: "At least \(AccountRules.minPasswordLength) characters",
                isNew: true, error: AccountRules.newPasswordError(password), submitLabel: .next
            )
            PasswordField(
                label: "Confirm new password", text: $confirm, placeholder: "Type it again", isNew: true,
                error: AccountRules.confirmPasswordError(password, confirm), submitLabel: .go, onSubmit: submit
            )
            Toggle("Sign out of other devices", isOn: $signOutOthers)
                .font(BrandFont.inter(15))
                .foregroundStyle(Palette.foreground)
                .tint(Palette.brand)
                .frame(minHeight: Metrics.minTap)

            if let resetNotice {
                FormErrorBanner(message: resetNotice, tone: .success)
            }
            if let errorMessage {
                FormErrorBanner(message: errorMessage)
            }
            SubmitButton(title: "Update password", isBusy: isSaving, action: submit)
                .disabled(!canSubmit)
                .padding(.top, 4)
        }
        .onChange(of: current) { currentError = nil }
        .alert("Password changed", isPresented: $didChange) {
            Button("OK", action: close)
        } message: {
            Text(signOutOthers ? "Your other devices have been signed out." : "Use your new password next time you sign in.")
        }
        .task { await session.loadSignInMethods() }
    }

    private func submit() {
        guard canSubmit else { return }
        errorMessage = nil
        currentError = nil
        guard password != current else {
            errorMessage = "Choose a password that’s different from your current one."
            return
        }
        isSaving = true
        Task {
            do throws(AuthError) {
                try await session.changePassword(current: current, new: password, signOutOthers: signOutOthers)
                didChange = true
            } catch {
                if error.code == "INVALID_PASSWORD" {
                    currentError = "That’s not your current password."
                } else {
                    errorMessage = error.message(fallback: "We couldn’t change your password. Try again.")
                }
            }
            isSaving = false
        }
    }

    private func sendResetLink() {
        isSendingReset = true
        resetNotice = nil
        Task {
            do throws(AuthError) {
                try await session.requestPasswordReset(email: user.email)
                resetNotice = "We’ve sent a link to \(user.email) to choose a new password."
            } catch {
                errorMessage = error.message(fallback: "We couldn’t send the email. Check your connection and try again.")
            }
            isSendingReset = false
        }
    }

    private func close() {
        dismiss()
    }
}
