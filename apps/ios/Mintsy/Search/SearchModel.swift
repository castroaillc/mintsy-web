import Foundation
import Observation

/// The Search tab's query and results. Typing waits `debounce` before asking the API, and an older answer never
/// replaces a newer query's.
@Observable
final class SearchModel {
    /// The backend returns nothing for shorter queries.
    static let minimumLength = 2
    static let debounce: Duration = .milliseconds(300)

    var query = ""
    var filter: SearchFilter = .all
    private(set) var phase: SearchPhase = .idle

    @ObservationIgnored private let client: GraphQLClient?

    init(client: GraphQLClient?) {
        self.client = client
    }

    private nonisolated struct SearchData: Decodable, Sendable {
        let search: SearchResponse
    }

    /// The query as the API gets it: trimmed and at most 100 characters (the backend's own limit).
    var trimmedQuery: String {
        String(query.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
    }

    /// Runs from `task(id: query)`: the task is cancelled when the query changes again, which is the debounce.
    func search(in catalog: CatalogStore) async {
        let text = trimmedQuery
        guard text.count >= Self.minimumLength else {
            phase = .idle
            return
        }
        do {
            try await Task.sleep(for: Self.debounce)
        } catch {
            return
        }
        guard let client else { return }
        if case .done(let results) = phase, results.query == text { return }
        phase = .searching
        do {
            let data = try await client.send(SearchQueries.search, variables: ["query": .string(text)], as: SearchData.self)
            guard !Task.isCancelled, text == trimmedQuery else { return }
            phase = .done(SearchResults(query: text, response: data.search, book: catalog.book(id:), episode: catalog.episode(id:)))
        } catch {
            guard !Task.isCancelled, text == trimmedQuery else { return }
            phase = .failed(error.localizedDescription)
        }
    }

    /// Try again after a failure.
    func retry(in catalog: CatalogStore) async {
        phase = .idle
        await search(in: catalog)
    }
}
