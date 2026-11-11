import SwiftUI

/// "BOOKS · 3" over a group of results.
struct SearchSectionTitle: View {
    let text: String

    var body: some View {
        Text(text)
            .font(BrandFont.inter(13, .semibold, relativeTo: .footnote))
            .textCase(.uppercase)
            .kerning(1)
            .foregroundStyle(Palette.mutedForeground)
            .padding(.top, 20)
            .padding(.bottom, 10)
            .accessibilityAddTraits(.isHeader)
    }
}
