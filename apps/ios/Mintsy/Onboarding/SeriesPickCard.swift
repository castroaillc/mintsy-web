import SwiftUI

/// A suggested first series as a radio card: cover, why it's suggested, title, author, episodes and runtime.
struct SeriesPickCard: View {
    let pick: Recommendation
    let isSelected: Bool
    let onSelect: (Recommendation) -> Void

    var body: some View {
        let book = pick.book
        let meta = "\(SeriesFormat.episodeCount(book.episodes.count)) · \(SeriesFormat.runtime(SeriesFormat.totalRuntime(book)))"
        RadioCard(isSelected: isSelected, label: "\(book.title) by \(book.author). \(pick.reason). \(meta)", action: select) {
            HStack(spacing: 14) {
                CoverTile(book: book, width: 72)
                VStack(alignment: .leading, spacing: 4) {
                    Text(pick.reason)
                        .font(BrandFont.inter(12, .semibold, relativeTo: .caption))
                        .foregroundStyle(Palette.brand)
                    Text(book.title)
                        .font(BrandFont.inter(16, .semibold, relativeTo: .headline))
                        .foregroundStyle(Palette.foreground)
                    Text(book.author)
                        .font(BrandFont.inter(13, relativeTo: .footnote))
                        .foregroundStyle(Palette.mutedForeground)
                    Text(meta)
                        .font(BrandFont.inter(13, relativeTo: .footnote))
                        .foregroundStyle(Palette.mutedForeground)
                }
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding([.leading, .vertical], 12)
        }
    }

    private func select() {
        onSelect(pick)
    }
}
