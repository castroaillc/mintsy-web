import SwiftUI

/// A series in progress: cover, title, where the viewer is, and a bar for the share of episodes watched.
struct InProgressRow: View {
    let item: ContinueItem
    let progress: [String: EpisodeProgress]

    var body: some View {
        let total = item.book.episodes.count
        let watched = ProgressLogic.watchedCount(item.book, progress)
        let fraction = ProgressLogic.seriesFraction(item.book, current: item.episode, progress)
        HStack(spacing: 14) {
            CoverTile(book: item.book, width: 48)
            VStack(alignment: .leading, spacing: 6) {
                Text(item.book.title)
                    .font(BrandFont.inter(15, .semibold, relativeTo: .headline))
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(1)
                Text("\(SeriesFormat.episodeLabel(item.episode, in: item.book)) · \(fraction, format: .percent.precision(.fractionLength(0)))")
                    .font(BrandFont.inter(13, relativeTo: .footnote))
                    .foregroundStyle(Palette.mutedForeground)
                ProgressBar(value: fraction)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: .rect(cornerRadius: 14))
        .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Palette.border) }
        .contentShape(.rect)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(item.book.title), \(SeriesFormat.episodeLabel(item.episode, in: item.book)), \(watched) of \(SeriesFormat.episodeCount(total)) watched")
        .accessibilityAddTraits(.isButton)
    }
}
