import Foundation

/// The GraphQL documents for My List and watch progress, matching the Expo app's (`src/lib/saved.tsx`,
/// `src/lib/progress.tsx`).
nonisolated enum LibraryQueries {
    static let progressFields = "episodeId bookId positionSec completed updatedAt"

    static let saved = "query MeSaved { me { savedBookIds savedEpisodeIds } }"

    static let setSaved = """
        mutation SetSaved($kind: SavedKind!, $id: ID!, $saved: Boolean!) {
          setSaved(kind: $kind, id: $id, saved: $saved) { savedBookIds savedEpisodeIds }
        }
        """

    static let progressSummary = """
        query MeProgressSummary($limit: Int) {
          me { continueWatching(limit: $limit) { \(progressFields) } finishedBookIds }
        }
        """

    static let bookProgress = "query MeBookProgress($bookId: ID!) { me { progress(bookId: $bookId) { \(progressFields) } } }"

    static let setProgress = """
        mutation SetProgress($episodeId: ID!, $positionSec: Int!, $completed: Boolean) {
          setProgress(episodeId: $episodeId, positionSec: $positionSec, completed: $completed) { \(progressFields) }
        }
        """

    /// `progress(bookId)` for several books in one request, aliased b0, b1, …
    static func booksProgress(count: Int) -> String {
        let indexes = 0..<count
        let variables = indexes.map { "$b\($0): ID!" }.joined(separator: ", ")
        let fields = indexes.map { "b\($0): progress(bookId: $b\($0)) { \(progressFields) }" }.joined(separator: " ")
        return "query MeBooksProgress(\(variables)) { me { \(fields) } }"
    }
}
