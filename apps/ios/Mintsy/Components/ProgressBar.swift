import SwiftUI

/// A thin progress bar (0–1) in the brand color.
struct ProgressBar: View {
    let value: Double
    var height: Double = 4
    var track: Color = Palette.border

    var body: some View {
        Rectangle()
            .fill(track)
            .frame(height: height)
            .overlay {
                Rectangle()
                    .fill(Palette.brand)
                    .scaleEffect(x: min(1, max(0, value)), y: 1, anchor: .leading)
            }
            .clipShape(.capsule)
            .accessibilityHidden(true)
    }
}
