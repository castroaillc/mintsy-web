import SwiftUI

/// Shown while a stored session is checked with the API (only when there's no cached user to show at once).
struct LaunchView: View {
    var body: some View {
        VStack(spacing: 24) {
            Wordmark(size: 34)
            ProgressView()
                .tint(Palette.mutedForeground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Loading mintsy")
    }
}
