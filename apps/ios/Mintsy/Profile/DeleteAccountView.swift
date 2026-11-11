import SwiftUI

/// Delete account (design 49, Expo `profile/delete-account.tsx`). Deletion is immediate: the API deletes the account
/// and everything it keeps about it. Accounts with a password confirm with it. Apple-only accounts have none: the API
/// accepts a sign-in from the last 10 minutes instead, and asks for a fresh one (`REAUTH_REQUIRED`) otherwise.
struct DeleteAccountView: View {
    let user: AuthUser

    @Environment(SessionStore.self) private var session
    @State private var password = ""
    @State private var understood = false
    @State private var passwordError: String?
    @State private var errorMessage: String?
    @State private var isDeleting = false
    @State private var needsAppleSignIn = false

    private var methods: SignInMethods { session.signInMethods }

    private var canDelete: Bool {
        session.signInMethodsLoaded && understood && !isDeleting && (!methods.hasPassword || !password.isEmpty)
    }

    var body: some View {
        AuthScreen(title: "Delete your account?", subtitle: "This permanently deletes your mintsy account. It can’t be undone.") {
            DeletedDataCard()
            SubscriptionNote()

            if methods.hasPassword {
                PasswordField(
                    label: "Password", text: $password, placeholder: "Enter your password to confirm",
                    error: passwordError, submitLabel: .done
                )
            } else {
                Text("You sign in with \(methods.providerName), so there’s no password to enter. We may ask you to confirm with \(methods.providerName).")
                    .font(BrandFont.inter(14, relativeTo: .subheadline))
                    .foregroundStyle(Palette.mutedForeground)
            }

            Toggle("I understand this can’t be undone", isOn: $understood)
                .font(BrandFont.inter(15))
                .foregroundStyle(Palette.foreground)
                .tint(Palette.destructive)
                .frame(minHeight: Metrics.minTap)

            if let errorMessage {
                FormErrorBanner(message: errorMessage)
            }

            if needsAppleSignIn {
                Text("For your security, confirm with Apple to delete your account.")
                    .font(BrandFont.inter(14, relativeTo: .subheadline))
                    .foregroundStyle(Palette.mutedForeground)
                AppleSignInButton(onToken: confirmWithApple, onFailure: show)
            } else {
                SubmitButton(title: "Delete my account", isBusy: isDeleting, variant: .destructive, action: delete)
                    .disabled(!canDelete)
                    .padding(.top, 4)
            }
        }
        .onChange(of: password) { passwordError = nil }
        .task { await session.loadSignInMethods() }
    }

    private func delete() {
        guard canDelete else { return }
        Task { await deleteAccount() }
    }

    private func deleteAccount() async {
        errorMessage = nil
        passwordError = nil
        isDeleting = true
        defer { isDeleting = false }
        do throws(AuthError) {
            try await session.deleteAccount(password: methods.hasPassword ? password : nil)
        } catch {
            switch error.code {
            case "INVALID_PASSWORD":
                passwordError = "That password isn’t right."
            case "REAUTH_REQUIRED", "SESSION_EXPIRED", "SESSION_NOT_FRESH":
                if methods.hasPassword {
                    errorMessage = error.message(fallback: "For your security, sign out and sign back in, then try again.")
                } else {
                    needsAppleSignIn = true
                }
            default:
                errorMessage = error.message(fallback: "We couldn’t delete your account. Try again.")
            }
        }
    }

    /// A fresh Apple sign-in, then the delete again. A different Apple ID would have switched the session: never
    /// delete someone else's account.
    private func confirmWithApple(_ token: AppleIDToken) {
        errorMessage = nil
        isDeleting = true
        Task {
            do throws(AuthError) {
                let signedIn = try await session.signInWithApple(token)
                guard signedIn.id == user.id else {
                    errorMessage = "That’s a different Apple account. Sign in with the account you want to delete."
                    isDeleting = false
                    return
                }
                needsAppleSignIn = false
                await deleteAccount()
            } catch {
                errorMessage = error.message(fallback: "We couldn’t confirm it’s you. Try again.")
                isDeleting = false
            }
        }
    }

    private func show(_ message: String) {
        errorMessage = message
    }
}
