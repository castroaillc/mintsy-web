import SwiftUI

/// Welcome's headline and line under it.
struct WelcomePitch: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Every great book, one 5-minute episode at a time.")
                .font(BrandFont.display(34, relativeTo: .largeTitle))
                .foregroundStyle(Palette.foreground)
                .accessibilityAddTraits(.isHeader)
            Text("Watch books as short video series, chapter by chapter, with a transcript for every episode.")
                .font(BrandFont.inter(16))
                .lineSpacing(5)
                .foregroundStyle(Palette.mutedForeground)
        }
        // Never truncated: when it doesn't fit, Welcome switches to its scrolling layout instead
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
