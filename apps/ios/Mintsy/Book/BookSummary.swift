import SwiftUI

/// Title, author, facts, Play or Resume, Save to My List, how much is watched, and the description.
struct BookSummary: View {
    let book: Book
    let start: PlayStart?
    let watched: Int
    let onPlay: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(book.title)
                .font(BrandFont.display(28, relativeTo: .title))
                .foregroundStyle(Palette.foreground)
                .accessibilityAddTraits(.isHeader)
            Text(book.author)
                .font(BrandFont.inter(15, relativeTo: .subheadline))
                .foregroundStyle(Palette.mutedForeground)
            FlowLayout(spacing: 8) {
                TagPill(text: "^[\(book.episodes.count) episode](inflect: true)")
                TagPill(text: "\(SeriesFormat.runtime(SeriesFormat.totalRuntime(book)))")
                TagPill(text: "\(book.category)")
                TagPill(text: "Transcripts")
            }

            HStack(spacing: 10) {
                if let start {
                    Button(action: onPlay) {
                        Label(playTitle(start), systemImage: "play.fill")
                    }
                    .buttonStyle(.brand(height: 52))
                }
                SaveBookButton(book: book)
            }
            .padding(.top, 6)

            if watched > 0 {
                WatchedProgress(watched: watched, total: book.episodes.count)
                    .padding(.top, 4)
            }

            Text(book.description)
                .font(BrandFont.inter(15))
                .lineSpacing(5)
                .foregroundStyle(Palette.secondaryForeground)
                .padding(.top, 6)
        }
    }

    private func playTitle(_ start: PlayStart) -> String {
        if start.episode.locked { return "Unlock Episode \(start.episode.number) with Premium" }
        return "\(start.resume ? "Resume" : "Play") \(SeriesFormat.episodeLabel(start.episode, in: book))"
    }
}
