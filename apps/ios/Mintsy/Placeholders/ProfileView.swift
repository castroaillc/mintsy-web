import SwiftUI

/// Profile tab: who's signed in and Sign out. Settings, plan, downloads and account screens are a later milestone.
struct ProfileView: View {
    let user: AuthUser

    @Environment(SessionStore.self) private var session
    @Environment(\.appConfig) private var config
    @State private var isSigningOut = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 14) {
                        Text(user.initial ?? "?")
                            .font(BrandFont.displayMedium(22, relativeTo: .title2))
                            .foregroundStyle(Palette.foreground)
                            .frame(width: 56, height: 56)
                            .background(Palette.surfaceRaised, in: .circle)
                            .overlay { Circle().strokeBorder(Palette.input) }
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.name)
                                .font(BrandFont.display(20, relativeTo: .title3))
                                .foregroundStyle(Palette.foreground)
                            Text(user.email)
                                .font(BrandFont.inter(14, relativeTo: .subheadline))
                                .foregroundStyle(Palette.mutedForeground)
                        }
                    }
                    .padding(.vertical, 6)
                }
                .listRowBackground(Palette.card)

                Section {
                    Button(role: .destructive, action: signOut) {
                        if isSigningOut {
                            ProgressView()
                        } else {
                            Text("Sign out")
                        }
                    }
                    .disabled(isSigningOut)
                }
                .listRowBackground(Palette.card)

                Section {
                    Text("Editing your profile, settings, your plan, downloads and finished series come in a later milestone.")
                        .font(BrandFont.inter(14, relativeTo: .subheadline))
                        .foregroundStyle(Palette.mutedForeground)
                } header: {
                    Text("Not built yet")
                }
                .listRowBackground(Palette.card)

                if let config {
                    Section("Build") {
                        LabeledContent("Variant", value: config.variant)
                        LabeledContent("API", value: config.apiURL.absoluteString)
                    }
                    .listRowBackground(Palette.card)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Palette.background)
            .navigationTitle("Profile")
        }
    }

    private func signOut() {
        isSigningOut = true
        Task {
            await session.signOut()
            isSigningOut = false
        }
    }
}
