import SwiftUI

/// Before a query: every series, as covers to browse.
struct SearchBrowseGrid: View {
    let books: [Book]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("^[\(books.count) series](inflect: true)")
                .font(BrandFont.inter(13, relativeTo: .footnote))
                .foregroundStyle(Palette.mutedForeground)
                .padding(.top, 12)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 104, maximum: 140), spacing: 12, alignment: .top)], alignment: .leading, spacing: 14) {
                ForEach(books) { book in
                    NavigationLink(value: BookRoute(bookID: book.id)) {
                        CoverTile(book: book, width: 104, showsEpisodeCount: true)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
