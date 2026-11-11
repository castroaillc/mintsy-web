import SwiftUI

/// Create account (design 5, Expo `(auth)/sign-up.tsx`): name, email and password, or Sign in with Apple.
/// Success signs the new account in and the root view moves on.
struct SignUpView: View {
    let onSignIn: () -> Void

    private enum Field { case name, email, password }

    @Environment(SessionStore.self) private var session
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isSubmitting = false
    @FocusState private var focus: Field?

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && AccountRules.isValidEmail(email)
            && AccountRules.isValidPassword(password) && !isSubmitting
    }

    var body: some View {
        AuthScreen(title: "Create account", subtitle: "It only takes a minute.") {
            SocialSignInSection()
            LabeledField(label: "Name") {
                TextField("Jane Doe", text: $name)
                    .textContentType(.name)
                    .submitLabel(.next)
                    .focused($focus, equals: .name)
                    .onSubmit { focus = .email }
            }
            LabeledField(label: "Email") {
                TextField("you@example.com", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.next)
                    .focused($focus, equals: .email)
                    .onSubmit { focus = .password }
            }
            PasswordField(
                label: "Password", text: $password, placeholder: "At least \(AccountRules.minPasswordLength) characters",
                isNew: true, hint: "Use at least \(AccountRules.minPasswordLength) characters.",
                error: AccountRules.newPasswordError(password), submitLabel: .join, onSubmit: submit
            )
            .focused($focus, equals: .password)

            if let errorMessage {
                FormErrorBanner(message: errorMessage)
            }

            SubmitButton(title: "Create account", isBusy: isSubmitting, action: submit)
                .disabled(!canSubmit)
                .padding(.top, 8)
        } footer: {
            AuthFooterLink(prompt: "Already have an account?", action: "Sign in", perform: onSignIn)
        }
    }

    private func submit() {
        guard canSubmit else { return }
        errorMessage = nil
        isSubmitting = true
        Task {
            do throws(AuthError) {
                try await session.signUp(name: name, email: email, password: password)
            } catch {
                errorMessage = error.message(fallback: "Unable to create your account. Try again.")
            }
            isSubmitting = false
        }
    }
}
