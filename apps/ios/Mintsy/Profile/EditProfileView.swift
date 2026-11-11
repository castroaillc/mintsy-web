import SwiftUI

/// Edit profile (design 12, Expo `profile/edit.tsx`): the name, and the email with a way to change it. Daily goal and
/// interests come with onboarding, which isn't in the native app yet.
struct EditProfileView: View {
    let user: AuthUser
    let onChangeEmail: () -> Void

    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(user: AuthUser, onChangeEmail: @escaping () -> Void) {
        self.user = user
        self.onChangeEmail = onChangeEmail
        _name = State(initialValue: user.name)
    }

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Avatar(name: trimmedName.isEmpty ? user.name : trimmedName, size: 92)
                    .padding(.top, 20)
                    .padding(.bottom, 8)

                LabeledField(label: "Name", error: trimmedName.isEmpty ? "Enter the name you’d like to show." : nil) {
                    TextField("Your name", text: $name)
                        .textContentType(.name)
                        .submitLabel(.done)
                        .onSubmit(save)
                }

                EditEmailField(email: user.email, methods: session.signInMethods, onChange: onChangeEmail)

                if let errorMessage {
                    FormErrorBanner(message: errorMessage)
                }
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.bottom, 32)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Palette.background)
        .navigationTitle("Edit profile")
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel", action: cancel)
            }
            ToolbarItem(placement: .confirmationAction) {
                if isSaving {
                    ProgressView()
                } else {
                    Button("Save", action: save)
                        .disabled(trimmedName.isEmpty)
                }
            }
        }
        .task { await session.loadSignInMethods() }
    }

    private func cancel() {
        dismiss()
    }

    private func save() {
        guard !trimmedName.isEmpty, !isSaving else { return }
        guard trimmedName != user.name else {
            dismiss()
            return
        }
        errorMessage = nil
        isSaving = true
        Task {
            do throws(AuthError) {
                try await session.updateName(trimmedName)
                dismiss()
            } catch {
                errorMessage = error.message(fallback: "We couldn’t save your name. Try again.")
            }
            isSaving = false
        }
    }
}
