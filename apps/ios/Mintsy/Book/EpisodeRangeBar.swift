import SwiftUI

/// "Chapters 1–10" pills for long books, and the average episode length.
struct EpisodeRangeBar: View {
    let book: Book
    @Binding var rangeStart: Int

    var body: some View {
        let starts = Array(stride(from: 0, to: book.episodes.count, by: Metrics.episodeRange))
        HStack(alignment: .center, spacing: 8) {
            if starts.count > 1 {
                FlowLayout(spacing: 8) {
                    ForEach(starts, id: \.self) { start in
                        CategoryChip(
                            label: "Chapters \(start + 1)–\(min(book.episodes.count, start + Metrics.episodeRange))",
                            isSelected: start == rangeStart,
                            compact: true
                        ) {
                            rangeStart = start
                        }
                    }
                }
            }
            Spacer(minLength: 0)
            if let minutes = SeriesFormat.averageEpisodeMinutes(book) {
                Text("~\(minutes) min each")
                    .font(BrandFont.inter(13, relativeTo: .footnote))
                    .foregroundStyle(Palette.mutedForeground)
                    .fixedSize()
            }
        }
    }
}
