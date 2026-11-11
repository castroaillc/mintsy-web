import SwiftUI

/// A finished series: opens its page; Watch again plays episode 1.
struct FinishedBookRow: View {
    let book: Book
    let onWatchAgain: () -> Void

    var body: some View {
        LibraryRow(actionTitle: "Watch \(book.title) again", actionImage: "arrow.counterclockwise", action: onWatchAgain) {
            NavigationLink(value: BookRoute(bookID: book.id)) {
                LibraryRowInfo(eyebrow: nil, title: book.title, meta: "Finished · \(SeriesFormat.episodeCount(book.episodes.count))", metaColor: Palette.success) {
                    CoverTile(book: book, width: 56)
                }
            }
        }
    }
}
