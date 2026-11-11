import SwiftUI

/// The "mintsy." wordmark from packages/brand (SVG in the asset catalog), sized by its font size like the Expo app's.
struct Wordmark: View {
    /// The wordmark's font size: the SVG is 3326×914 units at 1000 units per em.
    var size: Double = 22

    var body: some View {
        Image("Wordmark")
            .resizable()
            .scaledToFit()
            .frame(width: size * 3.326, height: size * 0.914)
            .accessibilityLabel("mintsy")
            .accessibilityAddTraits(.isHeader)
    }
}

#Preview {
    Wordmark(size: 26)
        .padding()
        .background(Palette.background)
}
