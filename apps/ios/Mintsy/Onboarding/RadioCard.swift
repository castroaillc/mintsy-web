import SwiftUI

/// A single-select card: brand border and tint when chosen, with a radio ring on the right unless it's a compact
/// tile (the Expo app's `RadioCard`).
struct RadioCard<Content: View>: View {
    let isSelected: Bool
    var showsIndicator = true
    var cornerRadius: Double = 16
    let label: String
    let action: () -> Void
    @ContentBuilder let content: Content

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                content
                if showsIndicator {
                    Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                        .font(.title3)
                        .foregroundStyle(isSelected ? Palette.brand : Palette.ring)
                        .accessibilityHidden(true)
                }
            }
            .frame(maxWidth: .infinity)
            .background(isSelected ? Palette.brand.opacity(0.05) : Palette.card, in: .rect(cornerRadius: cornerRadius))
            .overlay { RoundedRectangle(cornerRadius: cornerRadius).strokeBorder(isSelected ? Palette.brand : Palette.input) }
            .contentShape(.rect(cornerRadius: cornerRadius))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
