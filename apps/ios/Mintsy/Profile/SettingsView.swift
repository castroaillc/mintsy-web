import SwiftUI

/// Settings (design 13, Expo `profile/settings.tsx`): the account rows, support and legal links, Sign out and
/// Delete account. Playback, appearance and notification settings aren't in the native app yet.
struct SettingsView: View {
    let user: AuthUser

    @Environment(SessionStore.self) private var session
    @Environment(ProgressStore.self) private var progress
    @Environment(\.appConfig) private var config
    @State private var isConfirmingSignOut = false
    @State private var isSigningOut = false

    var body: some View {
        List {
            SettingsAccountSection(user: user, methods: session.signInMethods)

            Section("Support") {
                Link(destination: LegalLinks.support) {
                    LinkRowLabel(title: "Help & support", value: nil)
                }
                Link(destination: LegalLinks.terms) {
                    LinkRowLabel(title: "Terms of Use (EULA)", value: nil)
                }
                Link(destination: LegalLinks.privacy) {
                    LinkRowLabel(title: "Privacy Policy", value: nil)
                }
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Palette.card)

            if let config, config.variant != "production" {
                Section("This build") {
                    LabeledContent("Variant", value: config.variant)
                    LabeledContent("API", value: config.apiURL.absoluteString)
                }
                .listRowBackground(Palette.card)
            }

            Section {
                Button(role: .destructive, action: confirmSignOut) {
                    SubmitButtonLabel(title: "Sign out", isBusy: isSigningOut)
                }
                .disabled(isSigningOut)
                .confirmationDialog("Sign out?", isPresented: $isConfirmingSignOut, titleVisibility: .visible) {
                    Button("Sign out", role: .destructive, action: signOut)
                } message: {
                    Text("You’ll need to sign in again to watch.")
                }
            }
            .listRowBackground(Palette.card)

            Section {
                NavigationLink(value: ProfileRoute.deleteAccount) {
                    Text("Delete account")
                        .foregroundStyle(Palette.mutedForeground)
                }
            } footer: {
                Text("mintsy \(Bundle.main.shortVersion)")
                    .frame(maxWidth: .infinity)
                    .padding(.top, 12)
            }
            .listRowBackground(Palette.card)
        }
        .scrollContentBackground(.hidden)
        .background(Palette.background)
        .navigationTitle("Settings")
        .task { await session.loadSignInMethods() }
    }

    private func confirmSignOut() {
        isConfirmingSignOut = true
    }

    private func signOut() {
        isSigningOut = true
        Task {
            // Unsent progress goes up while the session still works
            await progress.send()
            await session.signOut()
        }
    }
}
