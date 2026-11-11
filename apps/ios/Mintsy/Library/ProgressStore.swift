import Foundation
import Observation
import OSLog

/// The signed-in viewer's watch progress, kept by the API (`setProgress`, `me.continueWatching`, `me.progress(bookId)`,
/// `me.finishedBookIds`) so it follows them between devices. Changes show at once and go to the API every
/// `sendInterval` while playing, or straight away on pause, seek, end and leaving the player. Saves that can't be
/// sent (offline) wait in memory and go with the next send.
///
/// Ported from the Expo app's `src/lib/progress.tsx`, without its on-device cache file: an app quit while offline
/// loses the unsent saves (the backlog notes it).
@Observable
final class ProgressStore: PlaybackProgressSink {
    /// While playing, positions go to the API this often.
    static let sendInterval: Duration = .seconds(10)
    /// The API's maximum for `continueWatching(limit)`.
    static let continueLimit = 50

    private(set) var progress: [String: EpisodeProgress] = [:]
    /// bookID → when it last changed on this device. The API's lists may not reflect those books yet.
    private(set) var touched: [String: Date] = [:]
    private(set) var apiContinueWatching: [APIProgress] = []
    private(set) var apiFinishedBookIDs: [String] = []
    /// True once the API's progress has loaded for this viewer.
    private(set) var loaded = false

    @ObservationIgnored private let client: GraphQLClient
    @ObservationIgnored private var queue: [String: PendingSave] = [:]
    /// episodeID → when it last changed here; an API answer from before that doesn't overwrite it.
    @ObservationIgnored private var changedAt: [String: Date] = [:]
    @ObservationIgnored private var inflight: Set<String> = []
    @ObservationIgnored private var sending = false
    @ObservationIgnored private var sendTask: Task<Void, Never>?
    /// Bumped by `reset`, so answers for the previous viewer are dropped.
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private let log = Logger(subsystem: "com.getmintsy.app", category: "progress")

    init(client: GraphQLClient) {
        self.client = client
    }

    private nonisolated struct SummaryData: Decodable, Sendable {
        nonisolated struct Me: Decodable, Sendable {
            let continueWatching: [APIProgress]
            let finishedBookIds: [String]
        }
        let me: Me?
    }

    private nonisolated struct BooksData: Decodable, Sendable {
        let me: [String: [APIProgress]]?
    }

    private nonisolated struct SetProgressData: Decodable, Sendable {
        let setProgress: APIProgress
    }

    // MARK: Reading

    func entry(for episodeID: String) -> EpisodeProgress? {
        progress[episodeID]
    }

    func continueWatching(in catalog: CatalogStore) -> [ContinueItem] {
        ProgressLogic.continueWatching(
            progress: progress, touched: touched, api: apiContinueWatching,
            book: catalog.book(id:), episode: catalog.episode(id:)
        )
    }

    func finishedBooks(in catalog: CatalogStore) -> [Book] {
        ProgressLogic.finishedBooks(progress: progress, touched: touched, api: apiFinishedBookIDs, book: catalog.book(id:))
    }

    // MARK: Local changes

    func setPosition(_ episodeID: String, positionSec: Int, saveNow: Bool = false) {
        let current = progress[episodeID]
        if current?.positionSec != positionSec {
            progress[episodeID] = EpisodeProgress(positionSec: positionSec, completed: current?.completed ?? false, updatedAt: .now)
            // A completion waiting to be sent stays part of the save
            queueSave(episodeID, PendingSave(positionSec: positionSec, completed: queue[episodeID]?.completed))
        }
        if saveNow {
            self.saveNow()
        } else if sendTask == nil, queue[episodeID] != nil {
            sendTask = Task { [weak self] in
                try? await Task.sleep(for: Self.sendInterval)
                guard !Task.isCancelled else { return }
                self?.sendTask = nil
                await self?.send()
            }
        }
    }

    /// Watched to the end. Rewatching starts from the top next time.
    func markCompleted(_ episodeID: String) {
        progress[episodeID] = EpisodeProgress(positionSec: 0, completed: true, updatedAt: .now)
        queueSave(episodeID, PendingSave(positionSec: 0, completed: true))
        saveNow()
    }

    func saveNow() {
        Task { await send() }
    }

    private func queueSave(_ episodeID: String, _ save: PendingSave) {
        let now = Date.now
        queue[episodeID] = save
        changedAt[episodeID] = now
        touched[ProgressLogic.bookID(ofEpisode: episodeID)] = now
    }

    // MARK: Talking to the API

    /// Sends every waiting save, one at a time. Stops at the first failure that isn't the API refusing it (offline).
    func send() async {
        sendTask?.cancel()
        sendTask = nil
        guard !sending else { return }
        sending = true
        defer { sending = false }
        let generation = generation
        var attempted: [String: PendingSave] = [:]
        while generation == self.generation, let next = queue.first(where: { attempted[$0.key] != $0.value }) {
            let (episodeID, save) = next
            attempted[episodeID] = save
            let startedAt = Date.now
            inflight.insert(episodeID)
            defer { inflight.remove(episodeID) }
            var variables: [String: GraphQLValue] = ["episodeId": .string(episodeID), "positionSec": .int(save.positionSec)]
            variables["completed"] = save.completed.map(GraphQLValue.bool) ?? .null
            do {
                let data = try await client.send(LibraryQueries.setProgress, variables: variables, as: SetProgressData.self)
                guard generation == self.generation else { return }
                settle(episodeID, save, startedAt: startedAt, result: data.setProgress)
            } catch {
                guard generation == self.generation else { return }
                // Unknown or unpublished episode, or Premium required: refused for good
                if error.code == "BAD_USER_INPUT" || error.code == "FORBIDDEN" {
                    log.warning("Progress for \(episodeID, privacy: .public) refused: \(error.localizedDescription, privacy: .public)")
                    settle(episodeID, save, startedAt: startedAt, result: nil)
                } else {
                    // Offline or the API is having trouble: keep it, and the rest, for the next send
                    log.info("Progress save failed, will retry: \(error.localizedDescription, privacy: .public)")
                    return
                }
            }
        }
    }

    /// A save is done (sent, or refused for good): drop it from the queue and take the API's answer if nothing
    /// newer happened here meanwhile.
    private func settle(_ episodeID: String, _ save: PendingSave, startedAt: Date, result: APIProgress?) {
        if queue[episodeID] == save { queue[episodeID] = nil }
        if let result, (changedAt[episodeID] ?? .distantPast) <= startedAt {
            progress[episodeID] = result.entry
        }
    }

    /// True when this device has a change for the episode that an API answer from `since` can't include.
    private func isLocalNewer(_ episodeID: String, since: Date) -> Bool {
        (changedAt[episodeID] ?? .distantPast) >= since || queue[episodeID] != nil || inflight.contains(episodeID)
    }

    /// Sends waiting saves, then reloads everything (sign-in, foreground, leaving the player, pull to refresh).
    func sync() async {
        await send()
        await refresh()
    }

    /// Continue watching, finished series, and the progress of every book in either. Keeps what's here when it fails.
    func refresh() async {
        let generation = generation
        let startedAt = Date.now
        do {
            let summary = try await client.send(
                LibraryQueries.progressSummary, variables: ["limit": .int(Self.continueLimit)], as: SummaryData.self
            )
            guard generation == self.generation, let me = summary.me else { return }
            var bookIDs: [String] = []
            for id in me.continueWatching.map(\.bookId) + me.finishedBookIds where !bookIDs.contains(id) {
                bookIDs.append(id)
            }
            var server: [String: EpisodeProgress] = [:]
            if !bookIDs.isEmpty {
                var variables: [String: GraphQLValue] = [:]
                for (index, id) in bookIDs.enumerated() { variables["b\(index)"] = .string(id) }
                let perBook = try await client.send(LibraryQueries.booksProgress(count: bookIDs.count), variables: variables, as: BooksData.self)
                guard generation == self.generation, let lists = perBook.me else { return }
                for item in lists.values.joined() { server[item.episodeId] = item.entry }
            }
            progress = ProgressLogic.merge(local: progress, server: server, inScope: { _ in true }) { [self] id in
                isLocalNewer(id, since: startedAt)
            }
            apiContinueWatching = me.continueWatching
            apiFinishedBookIDs = me.finishedBookIds
            // Books changed since the request started, or with saves still waiting, keep their on-device lists
            let waiting = Set((Array(queue.keys) + Array(inflight)).map(ProgressLogic.bookID(ofEpisode:)))
            touched = touched.filter { $0.value >= startedAt || waiting.contains($0.key) }
            loaded = true
        } catch {
            log.info("Couldn't load watch progress: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// One book's progress (its page), merged like `refresh`.
    func refreshBook(_ bookID: String) async {
        let generation = generation
        let startedAt = Date.now
        do {
            let data = try await client.send(
                LibraryQueries.booksProgress(count: 1), variables: ["b0": .string(bookID)], as: BooksData.self
            )
            guard generation == self.generation, let lists = data.me else { return }
            var server: [String: EpisodeProgress] = [:]
            for item in lists.values.joined() { server[item.episodeId] = item.entry }
            progress = ProgressLogic.merge(
                local: progress, server: server,
                inScope: { ProgressLogic.bookID(ofEpisode: $0) == bookID },
                isLocalNewer: { [self] id in isLocalNewer(id, since: startedAt) }
            )
        } catch {
            log.info("Couldn't load progress for \(bookID, privacy: .public): \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Signed out or the account is gone: forget everything, including unsent saves.
    func reset() {
        generation += 1
        sendTask?.cancel()
        sendTask = nil
        progress = [:]
        touched = [:]
        apiContinueWatching = []
        apiFinishedBookIDs = []
        loaded = false
        queue = [:]
        changedAt = [:]
        inflight = []
    }
}
