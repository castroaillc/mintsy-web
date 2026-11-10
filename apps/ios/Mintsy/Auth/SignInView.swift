import SwiftUI

/// Email and password sign-in for an existing account (design 6, "auth sign in"). Sign-up, Apple and Google
/// sign-in and password reset aren't in the native app yet, so they aren't shown.
struct SignInView: View {
    private enum Field { case email, password }

    @Environment(SessionStore.self) private var session
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isSubmitting = false
    @FocusState private var focus: Field?

    private var canSubmit: Bool { !email.isEmpty && !password.isEmpty && !isSubmitting }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Wordmark(size: 26)
                    .padding(.top, 16)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Welcome back")
                        .font(BrandFont.display(32, relativeTo: .largeTitle))
                        .foregroundStyle(Palette.foreground)
                        .accessibilityAddTraits(.isHeader)
                    Text("Sign in to pick up where you left off.")
                        .font(BrandFont.inter(16))
                        .foregroundStyle(Palette.mutedForeground)
                }
                .padding(.top, 32)

                VStack(alignment: .leading, spacing: 18) {
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
                    LabeledField(label: "Password") {
                        SecureField("Your password", text: $password)
                            .textContentType(.password)
                            .submitLabel(.go)
                            .focused($focus, equals: .password)
                            .onSubmit(submit)
                    }

                    if let errorMessage {
                        FormErrorBanner(message: errorMessage)
                    }

                    Button(action: submit) {
                        if isSubmitting {
                            ProgressView().tint(Palette.brandForeground)
                        } else {
                            Text("Sign in")
                        }
                    }
                    .buttonStyle(.brand(height: 54))
                    .disabled(!canSubmit)
                    .padding(.top, 8)
                    .accessibilityLabel("Sign in")
                }
                .padding(.top, 32)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Palette.background)
    }

    private func submit() {
        guard canSubmit else { return }
        errorMessage = nil
        isSubmitting = true
        Task {
            do {
                try await session.signIn(email: email, password: password)
            } catch {
                errorMessage = error.localizedDescription
            }
            isSubmitting = false
        }
    }
}

#if DEBUG
#Preview {
    SignInView()
        .environment(SessionStore.preview)
        .preferredColorScheme(.dark)
}
#endif
