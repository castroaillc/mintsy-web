import SwiftUI

/// Terms and Privacy next to the purchase button, where App Review looks for them.
struct PaywallLegalLinks: View {
    var body: some View {
        HStack(spacing: 6) {
            Link("Terms of Use (EULA)", destination: LegalLinks.terms)
            Text(verbatim: "·")
                .foregroundStyle(Palette.faint)
                .accessibilityHidden(true)
            Link("Privacy Policy", destination: LegalLinks.privacy)
        }
        .font(BrandFont.inter(12, relativeTo: .caption))
        .underline()
        .foregroundStyle(Palette.secondaryForeground)
        .frame(maxWidth: .infinity, minHeight: Metrics.minTap)
    }
}
