import SwiftUI

/// The email on Edit profile: read-only, with Change (or, for Apple-only accounts, where it comes from).
struct EditEmailField: View {
    let email: String
    let methods: SignInMethods
    let onChange: () -> Void

    var body: some View {
        LabeledField(
            label: "Email",
            hint: methods.isSocialOnly
                ? "You sign in with \(methods.providerName), so your email comes from there."
                : "If you change it, we’ll send a link to confirm the new address."
        ) {
            Text(email)
                .foregroundStyle(Palette.mutedForeground)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
        } accessory: {
            if !methods.isSocialOnly {
                Button("Change", action: onChange)
                    .font(BrandFont.inter(14, .medium, relativeTo: .subheadline))
                    .foregroundStyle(Palette.brand)
                    .frame(minHeight: Metrics.minTap)
                    .accessibilityLabel("Change email")
            }
        }
    }
}
