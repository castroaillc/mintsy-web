import Foundation
import Testing
@testable import Mintsy

/// ProgressStore and SavedStore against canned GraphQL answers.
struct LibraryStoreTests {
    private func client(host: String) -> GraphQLClient {
        GraphQLClient(endpoint: URL(string: "https://\(host)/graphql")!, session: StubURLProtocol.session()) { "better-auth.session_token=t" }
    }

    private func body(_ seen: StubURLProtocol.Seen) -> (query: String, variables: [String: Any]) {
        let object = (seen.body.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]) ?? [:]
        return (object["query"] as? String ?? "", object["variables"] as? [String: Any] ?? [:])
    }

    private nonisolated static func progressJSON(_ episode: String, _ position: Int, completed: Bool = false, at time: String = "2026-11-10T16:56:12.739Z") -> String {
        let book = episode.split(separator: "-").dropLast().joined(separator: "-")
        return #"{"episodeId":"\#(episode)","bookId":"\#(book)","positionSec":\#(position),"completed":\#(completed),"updatedAt":"\#(time)"}"#
    }

    @Test func savesPositionsWithTheMutationAndTakesTheAnswer() async throws {
        let host = "progress-send.test"
        StubURLProtocol.register(host: host) { _ in
            .init(body: Data(#"{"data":{"setProgress":\#(Self.progressJSON("b-1", 61))}}"#.utf8))
        }
        let store = ProgressStore(client: client(host: host))
        store.setPosition("b-1", positionSec: 61)
        #expect(store.entry(for: "b-1")?.positionSec == 61)
        #expect(store.touched["b"] != nil)
        await store.send()
        let sent = try #require(StubURLProtocol.requests(for: host).first.map(body))
        #expect(sent.query.contains("setProgress"))
        #expect(sent.variables["episodeId"] as? String == "b-1")
        #expect(sent.variables["positionSec"] as? Int == 61)
        #expect(sent.variables["completed"] is NSNull)
        // Nothing left to send
        await store.send()
        #expect(StubURLProtocol.requests(for: host).count == 1)
    }

    @Test func completionStartsTheEpisodeOverAndIsSentAtOnce() async throws {
        let host = "progress-complete.test"
        StubURLProtocol.register(host: host) { _ in
            .init(body: Data(#"{"data":{"setProgress":\#(Self.progressJSON("b-1", 0, completed: true))}}"#.utf8))
        }
        let store = ProgressStore(client: client(host: host))
        store.markCompleted("b-1")
        #expect(store.entry(for: "b-1")?.completed == true && store.entry(for: "b-1")?.positionSec == 0)
        await store.send()
        let sent = try #require(StubURLProtocol.requests(for: host).first.map(body))
        #expect(sent.variables["completed"] as? Bool == true)
    }

    @Test func aRefusedSaveIsDroppedButAnOfflineOneWaits() async {
        let refusedHost = "progress-refused.test"
        StubURLProtocol.register(host: refusedHost) { _ in
            .init(body: Data(#"{"errors":[{"message":"Premium required","extensions":{"code":"FORBIDDEN"}}],"data":null}"#.utf8))
        }
        let refused = ProgressStore(client: client(host: refusedHost))
        refused.setPosition("b-4", positionSec: 30)
        await refused.send()
        await refused.send()
        #expect(StubURLProtocol.requests(for: refusedHost).count == 1)

        let offlineHost = "progress-offline.test"
        StubURLProtocol.register(host: offlineHost) { _ in .init(status: 503, headers: [:], body: Data("down".utf8)) }
        let offline = ProgressStore(client: client(host: offlineHost))
        offline.setPosition("b-1", positionSec: 30)
        await offline.send()
        await offline.send()
        // Tried again: it was kept
        #expect(StubURLProtocol.requests(for: offlineHost).count == 2)
        #expect(offline.entry(for: "b-1")?.positionSec == 30)
    }

    @Test func refreshLoadsTheSummaryThenEveryBooksProgress() async throws {
        let host = "progress-refresh.test"
        StubURLProtocol.register(host: host) { seen in
            let query = (try? JSONSerialization.jsonObject(with: seen.body ?? Data()) as? [String: Any])?["query"] as? String ?? ""
            if query.contains("MeProgressSummary") {
                return .init(body: Data(#"{"data":{"me":{"continueWatching":[\#(Self.progressJSON("b-2", 40))],"finishedBookIds":["f"]}}}"#.utf8))
            }
            return .init(body: Data(#"{"data":{"me":{"b0":[\#(Self.progressJSON("b-1", 0, completed: true)),\#(Self.progressJSON("b-2", 40))],"b1":[\#(Self.progressJSON("f-1", 0, completed: true))]}}}"#.utf8))
        }
        let store = ProgressStore(client: client(host: host))
        await store.refresh()
        #expect(store.loaded)
        #expect(store.apiContinueWatching.map(\.episodeId) == ["b-2"])
        #expect(store.apiFinishedBookIDs == ["f"])
        #expect(store.entry(for: "b-1")?.completed == true)
        #expect(store.entry(for: "f-1")?.completed == true)
        let second = try #require(StubURLProtocol.requests(for: host).last.map(body))
        #expect(second.variables["b0"] as? String == "b")
        #expect(second.variables["b1"] as? String == "f")
        #expect(second.query.contains("b1: progress(bookId: $b1)"))
    }

    @Test func resetForgetsEverything() {
        let store = ProgressStore(client: client(host: "progress-reset.test"))
        store.setPosition("b-1", positionSec: 30)
        store.reset()
        #expect(store.progress.isEmpty && store.touched.isEmpty && !store.loaded)
    }

    @Test func savingShowsAtOnceAndTakesTheAPIsLists() async throws {
        let host = "saved-ok.test"
        StubURLProtocol.register(host: host) { _ in
            .init(body: Data(#"{"data":{"setSaved":{"savedBookIds":["b","a"],"savedEpisodeIds":[]}}}"#.utf8))
        }
        let store = SavedStore(client: client(host: host))
        await store.setSaved(.book, "b", saved: true)
        #expect(store.bookIDs == ["b", "a"])
        let sent = try #require(StubURLProtocol.requests(for: host).first.map(body))
        #expect(sent.variables["kind"] as? String == "BOOK")
        #expect(sent.variables["saved"] as? Bool == true)
    }

    @Test func aRefusedSaveRollsBackWithAMessage() async {
        let host = "saved-full.test"
        StubURLProtocol.register(host: host) { _ in
            .init(body: Data(#"{"errors":[{"message":"My List is full (500 per kind)","extensions":{"code":"BAD_USER_INPUT"}}],"data":null}"#.utf8))
        }
        let store = SavedStore(client: client(host: host))
        await store.setSaved(.episode, "b-1", saved: true)
        #expect(store.episodeIDs.isEmpty)
        #expect(store.failure?.title == "Couldn’t save")
        #expect(store.failure?.message == "My List is full. Remove something to make room.")
    }

    @Test func savedListsMoveTheLatestToTheFront() {
        #expect(SavedStore.updated(["a", "b"], "b", saved: true) == ["b", "a"])
        #expect(SavedStore.updated(["a", "b"], "a", saved: false) == ["b"])
        #expect(SavedStore.updated([], "x", saved: true) == ["x"])
    }

    @Test func loadReadsTheViewersLists() async {
        let host = "saved-load.test"
        StubURLProtocol.register(host: host) { _ in
            .init(body: Data(#"{"data":{"me":{"savedBookIds":["b"],"savedEpisodeIds":["b-2"]}}}"#.utf8))
        }
        let store = SavedStore(client: client(host: host))
        await store.load()
        #expect(store.loaded && store.isSaved(.book, "b") && store.isSaved(.episode, "b-2") && !store.isSaved(.book, "x"))
    }
}
