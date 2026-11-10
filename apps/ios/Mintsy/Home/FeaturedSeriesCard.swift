import SwiftUI

/// The featured series: cover on the book's tint, title, facts, and "Play Episode 1". Side by side in a regular-width
/// window, stacked otherwise.
struct FeaturedSeriesCard: View {
    let book: Book

    @Environment(PlayerPresenter.self) private var player
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        let wide = horizontalSizeClass == .regular
        let layout = wide ? AnyLayout(HStackLayout(spacing: 0)) : AnyLayout(VStackLayout(spacing: 0))
        layout {
            NavigationLink(value: BookRoute(bookID: book.id)) {
                CoverTile(book: book, width: 132)
                    .frame(maxWidth: wide ? 320 : .infinity)
                    .frame(height: 250)
                    .background(Color(hex: book.tint) ?? Palette.card)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open \(book.title)")

            FeaturedSeriesDetails(book: book, onPlay: playFirst)
                .padding(.horizontal, wide ? 24 : 18)
                .padding(.top, 18)
                .padding(.bottom, 20)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Palette.surfaceRaised)
        .clipShape(.rect(cornerRadius: BrandRadius.xl))
        .overlay { RoundedRectangle(cornerRadius: BrandRadius.xl).strokeBorder(Palette.border) }
    }

    private func playFirst() {
        if let first = book.episodes.first { player.open(first) }
    }
}
