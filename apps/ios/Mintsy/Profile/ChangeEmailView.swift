import SwiftUI

/// Settings › Email (Expo `profile/change-email.tsx`; not designed, follows the account screens). Better Auth emails
/// a confirmation link to the new address and a notice to the old one; opening the link comes back as
/// `<scheme>://email-changed`. A taken address also "succeeds", with no email, so nothing leaks.
struct ChangeEmailView: View {
    let user: AuthUser

    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var sentTo: String?
    @State private var errorMessage: String?
    @State private var isSending = false

    private var isSame: Bool { AccountRules.isSameEmail(email, user.email) }
    private var canSubmit: Bool { AccountRules.isValidEmail(email) && !isSame && !isSending }

    var body: some View {
        Group {
            if let sentTo {
                AuthScreen(title: "Check your new inbox", subtitle: "If \(sentTo) can be used, we’ve sent it a confirmation link. Open it on this iPhone to finish the change.") {
                    Text("Until then, keep signing in with \(user.email).")
                        .font(BrandFont.inter(15))
                        .foregroundStyle(Palette.mutedForeground)
                    Button("Done", action: close)
                        .buttonStyle(.brand(height: 54))
                        .padding(.top, 8)
                    Button("Use a different email", action: useAnotherEmail)
                        .buttonStyle(.brand(.outline, height: 48))
                }
            } else {
                AuthScreen(title: "Change email", subtitle: "We’ll send a link to confirm the new address. Your email doesn’t change until you open it.") {
                    LabeledField(label: "Current email") {
                        Text(user.email)
                            .foregroundStyle(Palette.mutedForeground)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    LabeledField(label: "New email", error: !email.isEmpty && isSame ? "That’s already your email." : nil) {
                        TextField("you@example.com", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .submitLabel(.send)
                            .onSubmit(submit)
                    }
                    if let errorMessage {
                        FormErrorBanner(message: errorMessage)
                    }
                    SubmitButton(title: "Send confirmation link", isBusy: isSending, action: submit)
                        .disabled(!canSubmit)
                        .padding(.top, 8)
                }
            }
        }
    }

    private func submit() {
        guard canSubmit else { return }
        errorMessage = nil
        isSending = true
        Task {
            do throws(AuthError) {
                let changedNow = try await session.changeEmail(to: email)
                if changedNow {
                    dismiss()
                } else {
                    sentTo = email.trimmingCharacters(in: .whitespacesAndNewlines)
                }
            } catch {
                errorMessage = error.message(fallback: "We couldn’t start the change. Try again.")
            }
            isSending = false
        }
    }

    private func useAnotherEmail() {
        sentTo = nil
        email = ""
    }

    private func close() {
        dismiss()
    }
}
