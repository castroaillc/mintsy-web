import SwiftUI

/// An icon-only round button (44 pt or larger). The title is kept for VoiceOver and Voice Control.
struct CircleIconButton: View {
    enum Variant { case scrim, surface, brand }

    let title: String
    let systemImage: String
    var variant: Variant = .scrim
    var size: Double = 44
    var iconSize: Double = 18
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .labelStyle(.iconOnly)
                .font(.system(size: iconSize, weight: .semibold))
                .foregroundStyle(foreground)
                .frame(width: max(Metrics.minTap, size), height: max(Metrics.minTap, size))
                .background(background, in: .circle)
                .overlay {
                    if variant == .surface { Circle().strokeBorder(Palette.input) }
                }
                .contentShape(.circle)
        }
        .buttonStyle(.plain)
    }

    private var foreground: Color {
        switch variant {
        case .scrim: Palette.onScrim
        case .surface: Palette.foreground
        case .brand: Palette.brandForeground
        }
    }

    private var background: Color {
        switch variant {
        case .scrim: Palette.scrim.opacity(0.6)
        case .surface: Palette.surfaceRaised
        case .brand: Palette.brand
        }
    }
}
