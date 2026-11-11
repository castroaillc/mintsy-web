import Foundation

/// The player's presentation: which episode it opened on, and where, when that isn't the saved place.
nonisolated struct PlayerRoute: Identifiable, Hashable, Sendable {
    let episodeID: String
    /// A point on the default voice's timeline (a search match); nil resumes from saved progress.
    var startSec: Double?

    var id: String { episodeID }
}
