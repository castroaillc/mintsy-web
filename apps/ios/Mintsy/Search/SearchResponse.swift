import Foundation

/// The API's answer to `search(query)`.
nonisolated struct SearchResponse: Decodable, Equatable, Sendable {
    nonisolated struct BookID: Decodable, Equatable, Sendable {
        let id: String
    }

    let books: [BookID]
    let episodes: [SearchHit]
}
