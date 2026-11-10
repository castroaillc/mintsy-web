import SwiftUI

/// Title, author, facts, the play button and the description.
struct BookSummary: View {
    let book: Book
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

            if let first = book.episodes.first {
                Button(action: onPlay) {
                    Label(
                        first.locked ? "Unlock Episode \(first.number) with Premium" : "Play \(SeriesFormat.episodeLabel(first, in: book))",
                        systemImage: "play.fill"
                    )
                }
                .buttonStyle(.brand(height: 52))
                .padding(.top, 6)
            }

            Text(book.description)
                .font(BrandFont.inter(15))
                .lineSpacing(5)
                .foregroundStyle(Palette.secondaryForeground)
                .padding(.top, 6)
        }
    }
}
