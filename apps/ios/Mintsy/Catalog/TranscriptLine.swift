import Foundation

/// One transcript line. `startSec` is whole seconds.
nonisolated struct TranscriptLine: Codable, Equatable, Hashable, Sendable {
    let startSec: Int
    let text: String
}
