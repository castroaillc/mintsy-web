import SwiftUI

/// The catalog's first load (design 51, "Home skeleton"): the featured series and a row of covers.
struct HomeLoadingView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            RoundedRectangle(cornerRadius: BrandRadius.xl).frame(height: 250)
            RoundedRectangle(cornerRadius: 6).frame(width: 150, height: 22).padding(.top, 8)
            HStack(spacing: 12) {
                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 8).frame(width: 124, height: 186)
                }
            }
        }
        .foregroundStyle(Palette.surfaceRaised)
        .padding(.horizontal, Metrics.gutter)
        .padding(.top, 20)
        .accessibilityElement()
        .accessibilityLabel("Loading")
    }
}
