import SwiftUI

/// A multi-select pill: brand border and tint when on (the Expo app's `SelectChip`). Large is 44 pt with a check
/// when selected (onboarding); compact is 38 pt with a 44 pt touch target (forms).
struct SelectChip: View {
    let label: String
    let isSelected: Bool
    var compact = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isSelected && !compact {
                    Image(systemName: "checkmark")
                        .font(.footnote.bold())
                        .accessibilityHidden(true)
                }
                Text(label)
                    .font(BrandFont.inter(compact ? 14 : 15, .medium, relativeTo: .subheadline))
            }
            .foregroundStyle(isSelected ? Palette.foreground : Palette.secondaryForeground)
            .padding(.horizontal, compact ? 14 : 16)
            .frame(minHeight: compact ? 38 : Metrics.minTap)
            .background(isSelected ? Palette.brand.opacity(0.1) : Palette.card, in: .capsule)
            .overlay { Capsule().strokeBorder(isSelected ? Palette.brand : Palette.input) }
            .padding(.vertical, compact ? 3 : 0)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
