import SwiftUI

/// Settings › Account: the plan, the email (to change it) and Change password. Apple-only accounts have neither of
/// the last two.
struct SettingsAccountSection: View {
    let user: AuthUser
    let methods: SignInMethods

    @Environment(PremiumStore.self) private var premium

    var body: some View {
        Section {
            NavigationLink(value: ProfileRoute.plan) {
                LabeledContent("Plan", value: planValue)
            }
            if methods.isSocialOnly {
                LabeledContent("Email") {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(user.email)
                        Text("You sign in with \(methods.providerName)")
                            .font(.footnote)
                            .foregroundStyle(Palette.faint)
                    }
                }
            } else {
                NavigationLink(value: ProfileRoute.changeEmail) {
                    LabeledContent("Email", value: user.email)
                }
                NavigationLink("Change password", value: ProfileRoute.changePassword)
            }
        } header: {
            Text("Account")
        }
        .listRowBackground(Palette.card)
    }

    /// "Free · Upgrade", or "Premium · Yearly" for a subscriber.
    private var planValue: String {
        guard premium.isPremium else { return "Free · Upgrade" }
        return premium.premium.planKind.map { "Premium · \($0.name)" } ?? "Premium"
    }
}
