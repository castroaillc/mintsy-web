import SwiftUI

/// 38 pt single-select pill (44 pt touch target). Selected is filled with the foreground color.
struct CategoryChip: View {
    let label: String
    let isSelected: Bool
    var compact = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(BrandFont.inter(14, .medium, relativeTo: .subheadline))
                .foregroundStyle(isSelected ? Palette.background : Palette.secondaryForeground)
                .padding(.horizontal, compact ? 14 : 16)
                .frame(minHeight: 38)
                .background(isSelected ? Palette.foreground : Palette.surfaceRaised, in: .capsule)
                .overlay { Capsule().strokeBorder(isSelected ? Palette.foreground : Palette.input) }
                .padding(.vertical, 3)
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
