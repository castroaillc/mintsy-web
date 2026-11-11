import SwiftUI

/// Reset password (design 45, Expo `(auth)/forgot-password.tsx`): asks Better Auth to email a link that opens
/// `<scheme>://reset-password` in this app. Then Check your email (design 46), which reads the same whether or not
/// the address has an account.
struct ForgotPasswordView: View {
    let onBackToSignIn: () -> Void

    @Environment(SessionStore.self) private var session
    @State private var email = ""
    @State private var sentTo: String?
    @State private var errorMessage: String?
    @State private var isSending = false
    @FocusState private var isFocused: Bool

    private var canSubmit: Bool { AccountRules.isValidEmail(email) && !isSending }

    var body: some View {
        if let sentTo {
            CheckEmailView(email: sentTo, onResend: resend, onUseAnotherEmail: useAnotherEmail, onBackToSignIn: onBackToSignIn)
        } else {
            AuthScreen(title: "Reset your password", subtitle: "Enter the email you signed up with and we’ll send you a link to set a new one.") {
                LabeledField(label: "Email") {
                    TextField("you@example.com", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.send)
                        .focused($isFocused)
                        .onSubmit(submit)
                }
                if let errorMessage {
                    FormErrorBanner(message: errorMessage)
                }
                SubmitButton(title: "Send reset link", isBusy: isSending, action: submit)
                    .disabled(!canSubmit)
            } footer: {
                AuthFooterLink(prompt: "Remembered it?", action: "Sign in", perform: onBackToSignIn)
            }
            .onAppear { isFocused = true }
        }
    }

    private func submit() {
        guard canSubmit else { return }
        Task { await send(to: email) }
    }

    private func resend() async -> Bool {
        guard let sentTo else { return false }
        return await send(to: sentTo)
    }

    @discardableResult
    private func send(to address: String) async -> Bool {
        errorMessage = nil
        isSending = true
        defer { isSending = false }
        do throws(AuthError) {
            try await session.requestPasswordReset(email: address)
            sentTo = address.trimmingCharacters(in: .whitespacesAndNewlines)
            return true
        } catch {
            // Only "couldn't reach the server" is worth telling apart; anything else would leak whether the account exists
            if case .network = error {
                errorMessage = "We couldn’t send the email. Check your connection and try again."
                return false
            }
            sentTo = address.trimmingCharacters(in: .whitespacesAndNewlines)
            return true
        }
    }

    private func useAnotherEmail() {
        sentTo = nil
    }
}
