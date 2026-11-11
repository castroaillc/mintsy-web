import Foundation

/// What a search found, resolved against the catalog: books and transcript matches still in it.
nonisolated struct SearchResults: Equatable, Sendable {
    /// One transcript match with its book and episode.
    nonisolated struct Match: Equatable, Sendable, Identifiable {
        let hit: SearchHit
        let book: Book
        let episode: Episode
        var id: String { hit.id }
    }

    let query: String
    let books: [Book]
    let matches: [Match]

    var isEmpty: Bool { books.isEmpty && matches.isEmpty }

    init(query: String, books: [Book], matches: [Match]) {
        self.query = query
        self.books = books
        self.matches = matches
    }

    /// Drops ids the catalog doesn't have (unpublished since, or a stale answer).
    init(query: String, response: SearchResponse, book: (String) -> Book?, episode: (String) -> (book: Book, episode: Episode)?) {
        self.query = query
        books = response.books.compactMap { book($0.id) }
        matches = response.episodes.compactMap { hit in
            episode(hit.episodeId).map { Match(hit: hit, book: $0.book, episode: $0.episode) }
        }
    }
}
