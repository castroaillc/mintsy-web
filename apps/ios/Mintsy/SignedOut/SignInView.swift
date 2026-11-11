import SwiftUI

/// Email and password sign-in (design 6, Expo `(auth)/sign-in.tsx`), with Sign in with Apple above it.
struct SignInView: View {
    let onCreateAccount: () -> Void
    let onForgotPassword: () -> Void

    private enum Field { case email, password }

    @Environment(SessionStore.self) private var session
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isSubmitting = false
    @FocusState private var focus: Field?

    private var canSubmit: Bool { !email.isEmpty && !password.isEmpty && !isSubmitting }

    var body: some View {
        AuthScreen(title: "Welcome back", subtitle: "Sign in to pick up where you left off.") {
            if let notice = session.notice {
                FormErrorBanner(message: notice, tone: .success)
            }
            SocialSignInSection()
            LabeledField(label: "Email") {
                TextField("you@example.com", text: $email)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.next)
                    .focused($focus, equals: .email)
                    .onSubmit { focus = .password }
            }
            PasswordField(label: "Password", text: $password, submitLabel: .go, onSubmit: submit) {
                Button("Forgot password?", action: onForgotPassword)
                    .font(BrandFont.inter(14, .medium, relativeTo: .subheadline))
                    .foregroundStyle(Palette.brand)
                    .frame(minHeight: Metrics.minTap)
            }
            .focused($focus, equals: .password)

            if let errorMessage {
                FormErrorBanner(message: errorMessage)
            }

            SubmitButton(title: "Sign in", isBusy: isSubmitting, action: submit)
                .disabled(!canSubmit)
                .padding(.top, 8)
        } footer: {
            AuthFooterLink(prompt: "New to mintsy?", action: "Create account", perform: onCreateAccount)
        }
    }

    private func submit() {
        guard canSubmit else { return }
        errorMessage = nil
        session.clearNotice()
        isSubmitting = true
        Task {
            do throws(AuthError) {
                try await session.signIn(email: email, password: password)
            } catch {
                errorMessage = error.message(fallback: "Unable to sign in. Try again.")
            }
            isSubmitting = false
        }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        SignInView(onCreateAccount: {}, onForgotPassword: {})
    }
    .environment(SessionStore.preview)
    .preferredColorScheme(.dark)
}
#endif
