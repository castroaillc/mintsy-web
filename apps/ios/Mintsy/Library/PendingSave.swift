import Foundation

/// A position not confirmed by the API yet. A nil `completed` keeps what's stored.
nonisolated struct PendingSave: Equatable, Sendable {
    var positionSec: Int
    var completed: Bool?
}
