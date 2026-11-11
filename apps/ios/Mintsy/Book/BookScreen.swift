import SwiftUI

/// A book's page by id: loading, not found, or the book.
struct BookScreen: View {
    let bookID: String

    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        if let book = catalog.book(id: bookID) {
            BookDetailView(book: book)
        } else if catalog.status == .loading {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Palette.background)
                .accessibilityLabel("Loading")
        } else {
            ContentUnavailableView("Book not found", systemImage: "books.vertical")
                .background(Palette.background)
        }
    }
}
