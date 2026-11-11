import SwiftUI

/// The art and text of a My List row, with an optional progress bar.
struct LibraryRowInfo<Art: View>: View {
    let eyebrow: String?
    let title: String
    let meta: String
    var metaColor: Color = Palette.mutedForeground
    var fraction: Double?
    @ContentBuilder let art: Art

    var body: some View {
        HStack(spacing: 14) {
            art
            VStack(alignment: .leading, spacing: 5) {
                if let eyebrow {
                    Text(eyebrow)
                        .font(BrandFont.inter(12, .semibold, relativeTo: .caption))
                        .foregroundStyle(Palette.mutedForeground)
                        .lineLimit(1)
                }
                Text(title)
                    .font(BrandFont.inter(15, .semibold, relativeTo: .headline))
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(2)
                Text(meta)
                    .font(BrandFont.inter(13, relativeTo: .footnote))
                    .foregroundStyle(metaColor)
                    .lineLimit(2)
                if let fraction {
                    ProgressBar(value: fraction)
                        .padding(.top, 2)
                }
            }
            .multilineTextAlignment(.leading)
        }
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
    }
}
