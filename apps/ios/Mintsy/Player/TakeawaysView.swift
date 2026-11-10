import SwiftUI

/// The episode's key takeaways, numbered.
struct TakeawaysView: View {
    let takeaways: [String]

    var body: some View {
        VStack(spacing: 12) {
            // A fixed list for this episode
            ForEach(Array(takeaways.enumerated()), id: \.offset) { index, text in
                HStack(alignment: .top, spacing: 14) {
                    Text(index + 1, format: .number)
                        .font(BrandFont.inter(13, .semibold, relativeTo: .footnote))
                        .foregroundStyle(Palette.brandForeground)
                        .frame(width: 28, height: 28)
                        .background(Palette.brand, in: .circle)
                        .accessibilityHidden(true)
                    Text(text)
                        .font(BrandFont.inter(15))
                        .lineSpacing(5)
                        .foregroundStyle(Palette.foreground)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(16)
                .background(Palette.card, in: .rect(cornerRadius: 14))
                .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Palette.border) }
                .accessibilityElement(children: .combine)
            }
        }
    }
}
