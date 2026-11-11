import Foundation
import Testing
@testable import Mintsy

/// The Expo app's `src/lib/series.ts` progress rules.
struct ProgressLogicTests {
    private static let book = Book(
        id: "b", title: "Book", author: "A", category: "Finance",
        episodes: (1...4).map { Episode(id: "b-\($0)", number: $0, title: "E\($0)", durationSec: 300) }
    )
    private static let other = Book(
        id: "o", title: "Other", author: "A", category: "Finance",
        episodes: (1...2).map { Episode(id: "o-\($0)", number: $0, title: "O\($0)", durationSec: 120) }
    )

    private func at(_ seconds: TimeInterval) -> Date { Date(timeIntervalSince1970: seconds) }
    private func entry(_ position: Int, done: Bool = false, at time: TimeInterval = 0) -> EpisodeProgress {
        EpisodeProgress(positionSec: position, completed: done, updatedAt: at(time))
    }

    @Test func statusAndFraction() {
        let episode = Self.book.episodes[0]
        #expect(ProgressLogic.status(nil) == .unwatched)
        #expect(ProgressLogic.status(entry(0)) == .unwatched)
        #expect(ProgressLogic.status(entry(30)) == .inProgress)
        #expect(ProgressLogic.status(entry(0, done: true)) == .watched)
        #expect(ProgressLogic.fraction(episode, entry(150)) == 0.5)
        #expect(ProgressLogic.fraction(episode, entry(0, done: true)) == 1)
        #expect(ProgressLogic.fraction(episode, entry(900)) == 1)
        #expect(ProgressLogic.fraction(episode, nil) == 0)
    }

    @Test func resumesOnlyAnEpisodeInProgress() {
        #expect(ProgressLogic.resumePosition(entry(42)) == 42)
        #expect(ProgressLogic.resumePosition(entry(42, done: true)) == 0)
        #expect(ProgressLogic.resumePosition(nil) == 0)
    }

    @Test func minutesLeftRoundsUpAndIsAtLeastOne() {
        let episode = Self.book.episodes[0]
        #expect(ProgressLogic.minutesLeft(episode, positionSec: 0) == 5)
        #expect(ProgressLogic.minutesLeft(episode, positionSec: 61) == 4)
        #expect(ProgressLogic.minutesLeft(episode, positionSec: 299) == 1)
        #expect(ProgressLogic.minutesLeft(episode, positionSec: 400) == 1)
    }

    @Test func playStartResumesTheLatestInProgressElseTheFirstUnwatched() {
        #expect(ProgressLogic.playStart(Self.book, [:]) == PlayStart(episode: Self.book.episodes[0], resume: false))
        let watchedTwo = ["b-1": entry(0, done: true), "b-2": entry(0, done: true)]
        #expect(ProgressLogic.playStart(Self.book, watchedTwo) == PlayStart(episode: Self.book.episodes[2], resume: false))
        let inProgress = ["b-1": entry(20), "b-3": entry(40)]
        #expect(ProgressLogic.playStart(Self.book, inProgress) == PlayStart(episode: Self.book.episodes[2], resume: true))
        let allDone = Dictionary(uniqueKeysWithValues: Self.book.episodes.map { ($0.id, entry(0, done: true)) })
        #expect(ProgressLogic.playStart(Self.book, allDone)?.episode.number == 1)
        #expect(ProgressLogic.isFinished(Self.book, allDone))
        #expect(!ProgressLogic.isFinished(Self.book, watchedTwo))
        #expect(ProgressLogic.watchedCount(Self.book, watchedTwo) == 2)
        #expect(!ProgressLogic.isFinished(Book(id: "e", title: "E", author: "A", category: "C"), [:]))
    }

    @Test func continueEpisodeFollowsTheAPIsRule() {
        // Latest saved isn't complete: that one
        #expect(ProgressLogic.continueEpisode(Self.book, ["b-1": entry(10, at: 1), "b-2": entry(10, at: 2)])?.number == 2)
        // Latest saved is complete: the next not completed
        #expect(ProgressLogic.continueEpisode(Self.book, ["b-2": entry(0, done: true, at: 5), "b-1": entry(10, at: 1)])?.number == 3)
        // The last episode is complete: wraps to an earlier one not completed
        let wrapped = ["b-4": entry(0, done: true, at: 9), "b-3": entry(0, done: true, at: 8), "b-1": entry(0, done: true, at: 1)]
        #expect(ProgressLogic.continueEpisode(Self.book, wrapped)?.number == 2)
        #expect(ProgressLogic.continueEpisode(Self.book, [:]) == nil)
    }

    @Test func episodeIDsGiveTheirBook() {
        #expect(ProgressLogic.bookID(ofEpisode: "the-science-of-getting-rich-12") == "the-science-of-getting-rich")
        #expect(ProgressLogic.bookID(ofEpisode: "odd") == "odd")
    }

    @Test func mergeKeepsWhatThisDeviceChangedSinceTheRequest() {
        let local = ["b-1": entry(50, at: 10), "b-2": entry(20, at: 1), "o-1": entry(5, at: 1)]
        let server = ["b-1": entry(30, at: 5), "b-2": entry(90, at: 6), "b-3": entry(0, done: true, at: 6)]
        let merged = ProgressLogic.merge(
            local: local, server: server,
            inScope: { $0.hasPrefix("b-") },
            isLocalNewer: { $0 == "b-1" }
        )
        #expect(merged["b-1"]?.positionSec == 50) // newer here
        #expect(merged["b-2"]?.positionSec == 90) // the server's
        #expect(merged["b-3"]?.completed == true) // new from the server
        #expect(merged["o-1"]?.positionSec == 5) // out of scope, kept
    }

    @Test func continueWatchingPutsBooksChangedHereFirst() {
        let books = [Self.book, Self.other]
        let api = [APIProgress(episodeId: "o-1", bookId: "o", positionSec: 10, completed: false, updatedAt: "2026-11-10T10:00:00Z")]
        let items = ProgressLogic.continueWatching(
            progress: ["b-2": entry(30, at: 100)],
            touched: ["b": at(100)],
            api: api,
            book: { id in books.first { $0.id == id } },
            episode: { id in books.lazy.compactMap { book in book.episodes.first { $0.id == id }.map { (book, $0) } }.first }
        )
        #expect(items.map(\.id) == ["b", "o"])
        #expect(items[0].episode.number == 2)
        #expect(items[1].entry?.positionSec == 10)
    }

    @Test func continueWatchingDropsWhatTheCatalogNoLongerHas() {
        let api = [APIProgress(episodeId: "gone-1", bookId: "gone", positionSec: 10, completed: false, updatedAt: "2026-11-10T10:00:00Z")]
        let items = ProgressLogic.continueWatching(progress: [:], touched: [:], api: api, book: { _ in nil }, episode: { _ in nil })
        #expect(items.isEmpty)
    }

    @Test func finishedBooksPutsTheOnesFinishedHereFirst() {
        let books = [Self.book, Self.other]
        let done = Dictionary(uniqueKeysWithValues: Self.other.episodes.map { ($0.id, entry(0, done: true, at: 50)) })
        let finished = ProgressLogic.finishedBooks(
            progress: done, touched: ["o": at(50)], api: ["b", "o"], book: { id in books.first { $0.id == id } }
        )
        #expect(finished.map(\.id) == ["o", "b"])
    }
}

extension ProgressLogicTests {
    @Test func seriesFractionCountsTheEpisodeInProgress() {
        let book = Book(
            id: "s", title: "S", author: "A", category: "C",
            episodes: (1...4).map { Episode(id: "s-\($0)", number: $0, title: "\($0)", durationSec: 100) }
        )
        let now = Date.now
        let progress = [
            "s-1": EpisodeProgress(positionSec: 0, completed: true, updatedAt: now),
            "s-2": EpisodeProgress(positionSec: 50, completed: false, updatedAt: now),
        ]
        #expect(ProgressLogic.seriesFraction(book, current: book.episodes[1], progress) == 0.375)
        #expect(ProgressLogic.seriesFraction(book, current: book.episodes[2], [:]) == 0)
    }
}
