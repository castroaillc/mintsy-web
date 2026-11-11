import Foundation

/// One transcript line that mentions the query (GraphQL `EpisodeMatch`).
nonisolated struct SearchHit: Decodable, Equatable, Sendable, Identifiable {
    /// `<bookId>-<number>-<startSec>`
    let id: String
    let bookId: String
    let episodeId: String
    /// Start of the line, in seconds on the default voice's timeline: the player opens here.
    let startSec: Int
    /// About 80–120 characters around the match, with a leading or trailing … when cut.
    let snippet: String
    /// Where the match is in `snippet`, in UTF-16 code units.
    let matchStart: Int
    let matchLength: Int

    /// The match's range in `snippet`, or nil when the offsets don't fit it.
    var matchRange: Range<String.Index>? {
        let utf16 = snippet.utf16
        guard matchStart >= 0, matchLength > 0, matchStart + matchLength <= utf16.count,
              let lower = utf16.index(utf16.startIndex, offsetBy: matchStart, limitedBy: utf16.endIndex),
              let upper = utf16.index(lower, offsetBy: matchLength, limitedBy: utf16.endIndex),
              let start = String.Index(lower, within: snippet),
              let end = String.Index(upper, within: snippet) else { return nil }
        return start..<end
    }
}
