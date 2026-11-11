import SwiftUI

/// A section title over a horizontal row of covers.
struct BookRail: View {
    let title: String
    let books: [Book]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: title)
                .padding(.horizontal, Metrics.gutter)
            ScrollView(.horizontal) {
                LazyHStack(spacing: 12) {
                    ForEach(books) { book in
                        NavigationLink(value: BookRoute(bookID: book.id)) {
                            CoverTile(book: book, showsEpisodeCount: true)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(book.title) by \(book.author)")
                    }
                }
                .padding(.horizontal, Metrics.gutter)
            }
            .scrollIndicators(.hidden)
        }
    }
}
