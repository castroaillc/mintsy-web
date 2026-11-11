import SwiftUI

/// A saved episode: plays it (or explains Premium); the bookmark removes it.
struct SavedEpisodeRow: View {
    let item: SavedEpisode
    let entry: EpisodeProgress?
    let onOpen: () -> Void
    let onRemove: () -> Void

    var body: some View {
        let eyebrow = "\(item.episode.locked ? "Premium · " : "")\(item.book.title) · Episode \(item.episode.number)"
        LibraryRow(actionTitle: "Remove \(item.episode.title) from My List", actionImage: "bookmark.fill", actionTint: Palette.brand, action: onRemove) {
            Button(action: onOpen) {
                LibraryRowInfo(
                    eyebrow: eyebrow, title: item.episode.title,
                    meta: SeriesFormat.time(Double(item.episode.durationSec)),
                    fraction: entry.map { ProgressLogic.fraction(item.episode, $0) }
                ) {
                    EpisodeThumb(episode: item.episode, size: .small, locked: item.episode.locked)
                }
            }
        }
    }
}
