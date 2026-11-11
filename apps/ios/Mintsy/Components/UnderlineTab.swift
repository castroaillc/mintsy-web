import SwiftUI

/// One tab of `UnderlineTabs`.
struct UnderlineTab: View {
    let title: String
    let isSelected: Bool
    let uniformWeight: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(BrandFont.inter(15, isSelected || uniformWeight ? .semibold : .medium, relativeTo: .subheadline))
                .foregroundStyle(isSelected ? Palette.foreground : Palette.mutedForeground)
                .frame(minHeight: 48)
                .overlay(alignment: .bottom) {
                    (isSelected ? Palette.brand : .clear).frame(height: 3)
                }
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isSelected, .isHeader] : [])
    }
}
