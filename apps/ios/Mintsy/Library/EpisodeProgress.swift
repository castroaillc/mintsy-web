import Foundation

/// The viewer's place in one episode. `positionSec` is always on the default voice's timeline, whichever narrator
/// was playing (backend `setProgress`).
nonisolated struct EpisodeProgress: Equatable, Sendable {
    var positionSec: Int
    var completed: Bool
    var updatedAt: Date
}
