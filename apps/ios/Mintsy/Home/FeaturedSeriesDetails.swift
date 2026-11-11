import SwiftUI

/// The text side of the featured card.
struct FeaturedSeriesDetails: View {
    let book: Book
    let start: PlayStart?
    let onPlay: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Featured series")
                .font(BrandFont.inter(12, .semibold, relativeTo: .caption))
                .textCase(.uppercase)
                .kerning(1.2)
                .foregroundStyle(Palette.brand)
            NavigationLink(value: BookRoute(bookID: book.id)) {
                Text(book.title)
                    .font(BrandFont.display(24, relativeTo: .title2))
                    .foregroundStyle(Palette.foreground)
                    .multilineTextAlignment(.leading)
            }
            .buttonStyle(.plain)
            Text("\(book.author) · ^[\(book.episodes.count) episode](inflect: true)\(minutesEach)")
                .font(BrandFont.inter(14, relativeTo: .subheadline))
                .foregroundStyle(Palette.mutedForeground)
            Button(action: onPlay) {
                Label("\(start?.resume == true ? "Resume" : "Play") Episode \(start?.episode.number ?? 1)", systemImage: "play.fill")
            }
            .buttonStyle(.brand(height: 48))
            .padding(.top, 6)
        }
    }

    /// " · 5 min each", or nothing when no durations are known.
    private var minutesEach: String {
        SeriesFormat.averageEpisodeMinutes(book).map { " · \($0) min each" } ?? ""
    }
}
