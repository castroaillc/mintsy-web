import Foundation

/// Where a book's main button starts: the episode in progress (Resume), or the first one not watched (Play).
nonisolated struct PlayStart: Equatable, Sendable {
    let episode: Episode
    let resume: Bool
}
