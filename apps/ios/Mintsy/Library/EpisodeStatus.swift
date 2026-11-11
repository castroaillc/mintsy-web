import Foundation

/// Where the viewer is with an episode.
nonisolated enum EpisodeStatus: Equatable, Sendable {
    case unwatched, inProgress, watched
}
