import SwiftUI

/// A section's heading on Home and the player.
struct SectionHeader: View {
    let title: String

    var body: some View {
        Text(title)
            .font(BrandFont.display(20, relativeTo: .title3))
            .foregroundStyle(Palette.foreground)
            .accessibilityAddTraits(.isHeader)
    }
}
