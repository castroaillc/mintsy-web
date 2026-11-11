import SwiftUI

/// The episode's place in the series, its title, and the series strip.
struct PlayerInfoSection: View {
    let book: Book
    let episode: Episode

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(SeriesFormat.episodeLabel(episode, in: book))
                .font(BrandFont.inter(13, .semibold, relativeTo: .footnote))
                .foregroundStyle(Palette.brand)
            Text(episode.title)
                .font(BrandFont.display(24, relativeTo: .title2))
                .foregroundStyle(Palette.foreground)
                .accessibilityAddTraits(.isHeader)
            Text("\(book.title) · \(book.author)")
                .font(BrandFont.inter(14, relativeTo: .subheadline))
                .foregroundStyle(Palette.mutedForeground)
            SegmentedProgress(count: book.episodes.count, currentIndex: episode.number - 1)
                .padding(.top, 4)
        }
    }
}
