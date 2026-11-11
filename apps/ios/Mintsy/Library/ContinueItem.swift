import Foundation

/// A Continue watching card: the catalog's book and episode, and the viewer's place in it.
nonisolated struct ContinueItem: Equatable, Sendable, Identifiable {
    let book: Book
    let episode: Episode
    let entry: EpisodeProgress?

    var id: String { book.id }
}
