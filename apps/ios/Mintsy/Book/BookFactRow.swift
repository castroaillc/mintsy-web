import SwiftUI

/// "Author … Name" in the About tab's facts.
struct BookFactRow: View {
    let label: LocalizedStringResource
    let value: LocalizedStringResource
    var showsDivider = true

    var body: some View {
        LabeledContent {
            Text(value)
                .font(BrandFont.inter(14, .medium, relativeTo: .subheadline))
                .foregroundStyle(Palette.foreground)
                .multilineTextAlignment(.trailing)
        } label: {
            Text(label)
                .font(BrandFont.inter(14, relativeTo: .subheadline))
                .foregroundStyle(Palette.mutedForeground)
        }
        .padding(.vertical, 14)
        .overlay(alignment: .top) {
            if showsDivider { Palette.border.frame(height: 1) }
        }
    }
}
