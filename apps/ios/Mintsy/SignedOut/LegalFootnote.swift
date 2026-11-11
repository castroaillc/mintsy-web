import SwiftUI

/// "By continuing you agree to our Terms and Privacy Policy." with both as links (`LegalLinks`).
struct LegalFootnote: View {
    var body: some View {
        // Markdown links must be literal: an interpolated URL isn't parsed as one
        Text("By continuing you agree to our [Terms](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) and [Privacy Policy](https://getmintsy.com/privacy).")
            .font(BrandFont.inter(12, relativeTo: .caption))
            .foregroundStyle(Palette.faint)
            .tint(Palette.secondaryForeground)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity)
    }
}
