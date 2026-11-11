import Foundation

/// Where a search is.
nonisolated enum SearchPhase: Equatable, Sendable {
    /// The query is too short to search: browse instead.
    case idle
    case searching
    case done(SearchResults)
    case failed(String)
}
