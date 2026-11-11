import SwiftUI

/// Welcome's decorative fan of covers (design 4): two tilted behind, one in front, and the featured book's first
/// episode in a pill underneath. Drawn at 342×330 and scaled to the room it's given.
struct CoverFan: View {
    nonisolated static let size = CGSize(width: 342, height: 330)

    let covers: WelcomeCovers
    let isLoading: Bool

    var body: some View {
        ZStack(alignment: .top) {
            FanCover(book: covers.left, width: 128, isLoading: isLoading)
                .rotationEffect(.degrees(-9))
                .offset(x: -85, y: 54)
            FanCover(book: covers.right, width: 128, isLoading: isLoading)
                .rotationEffect(.degrees(9))
                .offset(x: 85, y: 54)
            FanCover(book: covers.front, width: 152, isLoading: isLoading)
                .offset(y: 20)
            if let featured = covers.featured, let first = featured.episodes.first {
                Label {
                    Text("Episode 1 of \(featured.episodes.count) · \(SeriesFormat.time(Double(first.durationSec)))")
                } icon: {
                    Image(systemName: "play.fill")
                        .font(.system(size: 9))
                        .foregroundStyle(Palette.brandForeground)
                        .frame(width: 22, height: 22)
                        .background(Palette.brand, in: .circle)
                }
                .font(BrandFont.inter(13, .medium, relativeTo: .footnote))
                .foregroundStyle(Palette.foreground)
                .padding(.horizontal, 14)
                .frame(height: 40)
                .background(Palette.surfaceRaised, in: .capsule)
                .overlay { Capsule().strokeBorder(Palette.input) }
                .offset(y: 262)
            }
        }
        .frame(width: Self.size.width, height: Self.size.height, alignment: .top)
        .dynamicTypeSize(...DynamicTypeSize.large)
        .accessibilityHidden(true)
    }
}
