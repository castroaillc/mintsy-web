import SwiftUI

/// "—— or ——" between Sign in with Apple and the email forms.
struct OrDivider: View {
    var body: some View {
        HStack(spacing: 12) {
            Palette.border.frame(height: 1)
            Text("or")
                .font(BrandFont.inter(13, relativeTo: .footnote))
                .foregroundStyle(Palette.faint)
            Palette.border.frame(height: 1)
        }
        .accessibilityHidden(true)
    }
}
