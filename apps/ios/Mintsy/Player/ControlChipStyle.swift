import SwiftUI

/// The bordered 44 pt buttons under the video (previous, speed, narrator).
struct ControlChipStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(BrandFont.inter(14, .semibold, relativeTo: .subheadline))
            .foregroundStyle(Palette.foreground)
            .padding(.horizontal, 14)
            .frame(minWidth: 48, minHeight: Metrics.minTap)
            .background(Palette.card, in: .rect(cornerRadius: 10))
            .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(Palette.input) }
            .opacity(isEnabled ? (configuration.isPressed ? 0.7 : 1) : 0.4)
    }
}

extension ButtonStyle where Self == ControlChipStyle {
    static var controlChip: ControlChipStyle { ControlChipStyle() }
}
