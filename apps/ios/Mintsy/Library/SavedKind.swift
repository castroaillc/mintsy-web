import Foundation

/// GraphQL `SavedKind`: what a My List entry is.
nonisolated enum SavedKind: String, Sendable {
    case book = "BOOK"
    case episode = "EPISODE"
}
