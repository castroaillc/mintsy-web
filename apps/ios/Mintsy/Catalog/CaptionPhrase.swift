import Foundation

/// One timed caption phrase, on its voice's own timeline. Seconds may be fractional.
nonisolated struct CaptionPhrase: Codable, Equatable, Hashable, Sendable {
    let startSec: Double
    let endSec: Double
    let text: String
}
