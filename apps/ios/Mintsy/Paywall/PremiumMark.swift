import SwiftUI

/// The "m." mark with a check badge, on Welcome to Premium (design 19). Decorative.
struct PremiumMark: View {
    var body: some View {
        // Artwork, not text: it keeps its size at every text setting
        Text(verbatim: "m\(Text(verbatim: ".").foregroundStyle(Palette.brand))")
            .font(.custom(BrandFontName.displayBold, fixedSize: 92))
            .kerning(-3)
            .foregroundStyle(Palette.foreground)
            .offset(y: -9)
            .frame(width: 132, height: 132)
            .background(Palette.card, in: .rect(cornerRadius: 34))
            .overlay { RoundedRectangle(cornerRadius: 34).strokeBorder(Palette.border) }
            .overlay(alignment: .topTrailing) {
                Image(systemName: "checkmark")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Palette.brandForeground)
                    .frame(width: 40, height: 40)
                    .background(Palette.brand, in: .circle)
                    .offset(x: 10, y: -10)
            }
            .accessibilityHidden(true)
    }
}
