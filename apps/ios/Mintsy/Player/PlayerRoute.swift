import Foundation

/// The player's presentation: which episode it opened on.
nonisolated struct PlayerRoute: Identifiable, Hashable, Sendable {
    let episodeID: String
    var id: String { episodeID }
}
