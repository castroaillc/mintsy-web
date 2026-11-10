import Foundation
import Observation

/// The published catalog (`books`), loaded once and refreshed on pull-to-refresh. Locks depend on the viewer, so
/// it's loaded after sign-in, with the session cookie.
@Observable
final class CatalogStore {
    private(set) var books: [Book] = []
    private(set) var status: CatalogStatus = .loading

    @ObservationIgnored private let client: GraphQLClient
    @ObservationIgnored private let hlsEnabled: Bool

    init(client: GraphQLClient, hlsEnabled: Bool) {
        self.client = client
        self.hlsEnabled = hlsEnabled
    }

    /// Previews and tests.
    init(books: [Book], client: GraphQLClient, hlsEnabled: Bool = false) {
        self.books = books
        self.client = client
        self.hlsEnabled = hlsEnabled
        status = .ready
    }

    private nonisolated struct BooksData: Decodable, Sendable {
        let books: [Book]
    }

    /// Fetches the catalog. A failure keeps the books already shown, and only reports an error when there are none.
    func load() async {
        if books.isEmpty { status = .loading }
        do {
            let data = try await client.send(CatalogQueries.books(hlsEnabled: hlsEnabled), as: BooksData.self)
            books = data.books
            status = .ready
        } catch {
            if books.isEmpty {
                status = .failed(error.localizedDescription)
            }
        }
    }

    /// Forgets the viewer's catalog (sign-out).
    func reset() {
        books = []
        status = .loading
    }

    func book(id: String) -> Book? {
        books.first { $0.id == id }
    }

    /// The book and episode for an episode id (`<bookId>-<number>`).
    func episode(id: String) -> (book: Book, episode: Episode)? {
        for book in books {
            if let episode = book.episodes.first(where: { $0.id == id }) {
                return (book, episode)
            }
        }
        return nil
    }
}
