import SwiftUI

/// A saved series: opens its page; the bookmark removes it.
struct SavedBookRow: View {
    let book: Book
    let onRemove: () -> Void

    var body: some View {
        LibraryRow(actionTitle: "Remove \(book.title) from My List", actionImage: "bookmark.fill", actionTint: Palette.brand, action: onRemove) {
            NavigationLink(value: BookRoute(bookID: book.id)) {
                LibraryRowInfo(eyebrow: book.category, title: book.title, meta: "\(book.author) · \(SeriesFormat.episodeCount(book.episodes.count))") {
                    CoverTile(book: book, width: 56)
                }
            }
        }
    }
}
