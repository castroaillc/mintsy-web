import Foundation
import Observation
import OSLog

/// My List: the series and episodes the signed-in viewer saved, kept by the API (`me.savedBookIds`,
/// `me.savedEpisodeIds`, `setSaved`), most recently saved first. Changes show at once and roll back with a message
/// if the API refuses them, as the Expo app's `src/lib/saved.tsx` did.
@Observable
final class SavedStore {
    private(set) var bookIDs: [String] = []
    private(set) var episodeIDs: [String] = []
    /// True once the viewer's lists have loaded (or failed to).
    private(set) var loaded = false
    /// Why the last change didn't stick, for an alert. Cleared when it's dismissed.
    var failure: SavedFailure?

    @ObservationIgnored private let client: GraphQLClient
    /// Changes still waiting for the API; its answer only replaces the lists once none are.
    @ObservationIgnored private var pending = 0
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private let log = Logger(subsystem: "com.getmintsy.app", category: "saved")

    init(client: GraphQLClient) {
        self.client = client
    }

    private nonisolated struct Lists: Decodable, Sendable {
        let savedBookIds: [String]
        let savedEpisodeIds: [String]
    }

    private nonisolated struct MeData: Decodable, Sendable {
        let me: Lists?
    }

    private nonisolated struct SetSavedData: Decodable, Sendable {
        let setSaved: Lists
    }

    func isSaved(_ kind: SavedKind, _ id: String) -> Bool {
        switch kind {
        case .book: bookIDs.contains(id)
        case .episode: episodeIDs.contains(id)
        }
    }

    func load() async {
        let generation = generation
        do {
            let data = try await client.send(LibraryQueries.saved, as: MeData.self)
            guard generation == self.generation, pending == 0 else { return }
            apply(data.me ?? Lists(savedBookIds: [], savedEpisodeIds: []))
        } catch {
            log.info("Couldn't load My List: \(error.localizedDescription, privacy: .public)")
        }
        if generation == self.generation { loaded = true }
    }

    func toggle(_ kind: SavedKind, _ id: String) {
        let saved = !isSaved(kind, id)
        Task { await setSaved(kind, id, saved: saved) }
    }

    /// Saves (moved to the front) or removes at once, then asks the API; undoes just this change if it refuses.
    func setSaved(_ kind: SavedKind, _ id: String, saved: Bool) async {
        let generation = generation
        change(kind, id, saved: saved)
        pending += 1
        let variables: [String: GraphQLValue] = ["kind": .string(kind.rawValue), "id": .string(id), "saved": .bool(saved)]
        do {
            let data = try await client.send(LibraryQueries.setSaved, variables: variables, as: SetSavedData.self)
            guard generation == self.generation else { return }
            pending -= 1
            if pending == 0 { apply(data.setSaved) }
        } catch {
            guard generation == self.generation else { return }
            pending -= 1
            change(kind, id, saved: !saved)
            failure = SavedFailure(saving: saved, error: error)
        }
    }

    /// Signed out: forget the lists.
    func reset() {
        generation += 1
        pending = 0
        bookIDs = []
        episodeIDs = []
        loaded = false
        failure = nil
    }

    private func change(_ kind: SavedKind, _ id: String, saved: Bool) {
        switch kind {
        case .book: bookIDs = Self.updated(bookIDs, id, saved: saved)
        case .episode: episodeIDs = Self.updated(episodeIDs, id, saved: saved)
        }
    }

    private func apply(_ lists: Lists) {
        bookIDs = lists.savedBookIds
        episodeIDs = lists.savedEpisodeIds
    }

    /// `ids` with `id` saved (at the front) or removed.
    nonisolated static func updated(_ ids: [String], _ id: String, saved: Bool) -> [String] {
        let rest = ids.filter { $0 != id }
        return saved ? [id] + rest : rest
    }
}
