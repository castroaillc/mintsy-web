import Foundation

/// A saved episode with its book.
nonisolated struct SavedEpisode: Equatable, Sendable, Identifiable {
    let book: Book
    let episode: Episode
    var id: String { episode.id }
}
