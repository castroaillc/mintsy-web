import Foundation

/// `EpisodeProgress` as the API returns it, without the nested episode and book (the catalog has those).
nonisolated struct APIProgress: Decodable, Equatable, Sendable {
    let episodeId: String
    let bookId: String
    let positionSec: Int
    let completed: Bool
    /// ISO 8601, server time.
    let updatedAt: String

    var entry: EpisodeProgress {
        EpisodeProgress(positionSec: positionSec, completed: completed, updatedAt: ISODate.parse(updatedAt) ?? .distantPast)
    }
}
