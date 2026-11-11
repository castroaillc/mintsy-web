import Foundation
import Testing
@testable import Mintsy

struct SearchTests {
    @Test func matchOffsetsAreUTF16() throws {
        // "💸" is two UTF-16 code units: the backend's offsets count it as two
        let hit = SearchHit(id: "b-1-8", bookId: "b", episodeId: "b-1", startSec: 8, snippet: "💸 Money is the root", matchStart: 3, matchLength: 5)
        let range = try #require(hit.matchRange)
        #expect(hit.snippet[range] == "Money")
        let bad = SearchHit(id: "x", bookId: "b", episodeId: "b-1", startSec: 0, snippet: "short", matchStart: 3, matchLength: 10)
        #expect(bad.matchRange == nil)
    }

    @Test func snippetsAreQuotedWithTheMatchMarked() {
        let hit = SearchHit(id: "b-1-8", bookId: "b", episodeId: "b-1", startSec: 8, snippet: "Money is the root of evil.", matchStart: 0, matchLength: 5)
        let text = SnippetText.highlighted(hit)
        #expect(String(text.characters) == "“Money is the root of evil.”")
        #expect(text.runs.count == 3)
    }

    @Test func resultsKeepOnlyWhatTheCatalogHas() {
        let episode = Episode(id: "b-1", number: 1, title: "One", durationSec: 60)
        let book = Book(id: "b", title: "Book", author: "A", category: "Finance", episodes: [episode])
        let response = SearchResponse(
            books: [.init(id: "b"), .init(id: "gone")],
            episodes: [
                SearchHit(id: "b-1-8", bookId: "b", episodeId: "b-1", startSec: 8, snippet: "s", matchStart: 0, matchLength: 1),
                SearchHit(id: "gone-1-8", bookId: "gone", episodeId: "gone-1", startSec: 8, snippet: "s", matchStart: 0, matchLength: 1),
            ]
        )
        let results = SearchResults(
            query: "s", response: response,
            book: { $0 == "b" ? book : nil },
            episode: { $0 == "b-1" ? (book, episode) : nil }
        )
        #expect(results.books.map(\.id) == ["b"])
        #expect(results.matches.map(\.id) == ["b-1-8"])
        #expect(!results.isEmpty)
    }

    @Test func shortQueriesDontSearch() async {
        let catalog = CatalogStore(books: [], client: .init(endpoint: URL(string: "https://search-none.test/graphql")!, session: StubURLProtocol.session()) { nil })
        let model = SearchModel(client: nil)
        model.query = " m "
        await model.search(in: catalog)
        #expect(model.phase == .idle)
        #expect(model.trimmedQuery == "m")
    }

    @Test func searchesAndResolvesAgainstTheCatalog() async throws {
        let host = "search-ok.test"
        StubURLProtocol.register(host: host) { _ in
            .init(body: Data(#"{"data":{"search":{"books":[{"id":"b"}],"episodes":[{"id":"b-1-8","bookId":"b","episodeId":"b-1","startSec":8,"snippet":"Money","matchStart":0,"matchLength":5}]}}}"#.utf8))
        }
        let client = GraphQLClient(endpoint: URL(string: "https://\(host)/graphql")!, session: StubURLProtocol.session()) { nil }
        let episode = Episode(id: "b-1", number: 1, title: "One", durationSec: 60)
        let catalog = CatalogStore(books: [Book(id: "b", title: "Book", author: "A", category: "Finance", episodes: [episode])], client: client)
        let model = SearchModel(client: client)
        model.query = "money"
        await model.search(in: catalog)
        guard case .done(let results) = model.phase else {
            Issue.record("Expected results, got \(model.phase)")
            return
        }
        #expect(results.query == "money")
        #expect(results.books.count == 1 && results.matches.first?.hit.startSec == 8)
        let sent = try #require(StubURLProtocol.requests(for: host).first?.body)
        let variables = (try JSONSerialization.jsonObject(with: sent) as? [String: Any])?["variables"] as? [String: Any]
        #expect(variables?["query"] as? String == "money")
    }

    @Test func welcomeFillsTheFanWithSampleCovers() {
        let real = Book(id: "r", title: "Real", author: "A", category: "Finance", episodes: [Episode(id: "r-1", number: 1, title: "1", durationSec: 60)])
        let covers = WelcomeCovers(books: [real])
        #expect(covers.front.id == "r" && covers.featured?.id == "r")
        #expect(covers.left.id == "sample-0" && covers.right.id == "sample-1")
        #expect(WelcomeCovers(books: []).featured == nil)
    }
}
