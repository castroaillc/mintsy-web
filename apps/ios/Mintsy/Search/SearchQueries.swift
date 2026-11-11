import Foundation

/// The backend's catalog search (`search(query)`, public): books by title, author or category, and transcript lines
/// that mention the query. Books and episodes are looked up in the catalog the app already has.
nonisolated enum SearchQueries {
    static let search = """
        query Search($query: String!) {
          search(query: $query) {
            books { id }
            episodes { id bookId episodeId startSec snippet matchStart matchLength }
          }
        }
        """
}
