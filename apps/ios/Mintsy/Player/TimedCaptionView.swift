import SwiftUI

/// One timed phrase along the bottom of the video, lifted clear of the transport while the controls show.
struct TimedCaptionView: View {
    /// With the controls hidden, up from the bottom edge.
    static let lowered: Double = 12
    /// With the controls showing: above the scrubber (44) and the 60 pt play button, plus a gap.
    static let raised: Double = 44 + 60 + 8

    let text: String
    let isRaised: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Text(text)
            .font(BrandFont.inter(15, .medium, relativeTo: .callout))
            .multilineTextAlignment(.center)
            .foregroundStyle(Palette.onScrim)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Palette.scrim.opacity(0.8), in: .rect(cornerRadius: 6))
            .frame(maxWidth: 620)
            .padding(.bottom, isRaised ? Self.raised : Self.lowered)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.18), value: isRaised)
            .accessibilityAddTraits(.updatesFrequently)
    }
}
