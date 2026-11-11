import SwiftUI

/// A book that matches: cover, title, author and episode count.
struct SearchBookRow: View {
    let book: Book

    var body: some View {
        HStack(spacing: 14) {
            CoverTile(book: book, width: 48)
            VStack(alignment: .leading, spacing: 4) {
                Text(book.title)
                    .font(BrandFont.inter(15, .semibold, relativeTo: .headline))
                    .foregroundStyle(Palette.foreground)
                Text("\(book.author) · ^[\(book.episodes.count) episode](inflect: true)")
                    .font(BrandFont.inter(13, relativeTo: .footnote))
                    .foregroundStyle(Palette.mutedForeground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Palette.faint)
                .accessibilityHidden(true)
        }
        .padding(8)
        .background(Palette.card, in: .rect(cornerRadius: 14))
        .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Palette.border) }
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
    }
}
