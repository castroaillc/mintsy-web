import SwiftUI

/// A series in progress: where the viewer is in the current episode, and Resume.
struct InProgressListRow: View {
    let item: ContinueItem
    let onResume: () -> Void

    var body: some View {
        let position = item.entry?.positionSec ?? 0
        let meta = "\(SeriesFormat.episodeLabel(item.episode, in: item.book)) · \(ProgressLogic.minutesLeft(item.episode, positionSec: position)) min left"
        LibraryRow(actionTitle: "Resume \(item.book.title)", actionImage: item.episode.locked ? "lock.fill" : "play.fill", action: onResume) {
            NavigationLink(value: BookRoute(bookID: item.book.id)) {
                LibraryRowInfo(eyebrow: nil, title: item.book.title, meta: meta, fraction: ProgressLogic.fraction(item.episode, item.entry)) {
                    CoverTile(book: item.book, width: 56)
                }
            }
        }
    }
}
