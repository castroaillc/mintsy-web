import SwiftUI

/// The coral call-to-action (`BrandButton` in the Expo app), or its quiet outline sibling.
struct BrandButtonStyle: ButtonStyle {
    enum Variant { case brand, outline }

    var variant: Variant = .brand
    /// 44 (compact), 48, 52 (hero) or 56.
    var height: Double = 48

    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(BrandFont.inter(textSize, variant == .brand || height >= 54 ? .semibold : .medium, relativeTo: .headline))
            .lineLimit(1)
            .foregroundStyle(foreground)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: max(Metrics.minTap, height))
            .background(background, in: .rect(cornerRadius: radius))
            .overlay {
                if variant == .outline {
                    RoundedRectangle(cornerRadius: radius).strokeBorder(Palette.borderStrong)
                }
            }
            .contentShape(.rect(cornerRadius: radius))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }

    private var textSize: Double { height >= 56 ? 17 : height >= 52 ? 16 : height >= 48 ? 15 : 14 }
    private var radius: Double { height >= 54 ? 14 : height >= 48 ? 12 : 10 }

    private var foreground: Color {
        switch variant {
        case .brand: isEnabled ? Palette.brandForeground : Palette.mutedForeground
        case .outline: Palette.foreground
        }
    }

    private var background: Color {
        switch variant {
        case .brand: isEnabled ? Palette.brand : Palette.border
        case .outline: .clear
        }
    }
}

extension ButtonStyle where Self == BrandButtonStyle {
    static var brand: BrandButtonStyle { BrandButtonStyle() }

    static func brand(_ variant: BrandButtonStyle.Variant = .brand, height: Double = 48) -> BrandButtonStyle {
        BrandButtonStyle(variant: variant, height: height)
    }
}
