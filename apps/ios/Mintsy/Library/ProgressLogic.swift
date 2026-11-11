import Foundation

/// Watch-progress rules, ported from the Expo app (git 75b0adc, `src/lib/series.ts` and `src/lib/progress.tsx`).
/// Progress maps are keyed by episode id (`<bookId>-<number>`).
nonisolated enum ProgressLogic {
    typealias ProgressMap = [String: EpisodeProgress]

    static func status(_ entry: EpisodeProgress?) -> EpisodeStatus {
        guard let entry else { return .unwatched }
        if entry.completed { return .watched }
        return entry.positionSec > 0 ? .inProgress : .unwatched
    }

    /// 0–1, for progress bars. Watched episodes read as full.
    static func fraction(_ episode: Episode, _ entry: EpisodeProgress?) -> Double {
        guard let entry else { return 0 }
        if entry.completed { return 1 }
        guard episode.durationSec > 0 else { return 0 }
        return min(1, max(0, Double(entry.positionSec) / Double(episode.durationSec)))
    }

    /// Where the player starts: the saved position of an episode in progress, else the top.
    static func resumePosition(_ entry: EpisodeProgress?) -> Double {
        status(entry) == .inProgress ? Double(entry?.positionSec ?? 0) : 0
    }

    /// "3 min left": whole minutes, at least 1.
    static func minutesLeft(_ episode: Episode, positionSec: Int) -> Int {
        max(1, Int((Double(episode.durationSec - positionSec) / 60).rounded(.up)))
    }

    /// 0–1 of a whole series: episodes watched, plus the share of the one in progress.
    static func seriesFraction(_ book: Book, current: Episode, _ progress: ProgressMap) -> Double {
        guard !book.episodes.isEmpty else { return 0 }
        let entry = progress[current.id]
        let partial = entry?.completed == true ? 0 : fraction(current, entry)
        return min(1, (Double(watchedCount(book, progress)) + partial) / Double(book.episodes.count))
    }

    static func watchedCount(_ book: Book, _ progress: ProgressMap) -> Int {
        book.episodes.count { progress[$0.id]?.completed == true }
    }

    /// Every episode completed (a book with no episodes can't have been finished).
    static func isFinished(_ book: Book, _ progress: ProgressMap) -> Bool {
        !book.episodes.isEmpty && watchedCount(book, progress) == book.episodes.count
    }

    /// Where the book's Play/Resume button starts: the latest episode in progress, else the first one not watched.
    static func playStart(_ book: Book, _ progress: ProgressMap) -> PlayStart? {
        if let resume = book.episodes.last(where: { status(progress[$0.id]) == .inProgress }) {
            return PlayStart(episode: resume, resume: true)
        }
        guard let episode = book.episodes.first(where: { progress[$0.id]?.completed != true }) ?? book.episodes.first else {
            return nil
        }
        return PlayStart(episode: episode, resume: false)
    }

    /// Where Continue watching picks up in a book, by the API's rule (`continueWatching`): the most recently saved
    /// episode if it isn't completed, otherwise the next one that isn't (then earlier ones). Nil when nothing has
    /// been watched or every episode is completed.
    static func continueEpisode(_ book: Book, _ progress: ProgressMap) -> Episode? {
        let started = book.episodes.filter { progress[$0.id] != nil }
        func savedAt(_ episode: Episode) -> Date { progress[episode.id]?.updatedAt ?? .distantPast }
        guard let latest = started.max(by: { savedAt($0) < savedAt($1) }) else { return nil }
        if progress[latest.id]?.completed != true { return latest }
        let index = latest.number - 1
        let after = book.episodes.dropFirst(index + 1)
        let before = book.episodes.prefix(max(0, index))
        return (Array(after) + Array(before)).first { progress[$0.id]?.completed != true }
    }

    /// `<bookId>-<number>` → bookId.
    static func bookID(ofEpisode episodeID: String) -> String {
        guard let match = episodeID.wholeMatch(of: /(.+)-\d+/) else { return episodeID }
        return String(match.1)
    }

    /// The server's entries for the episodes `inScope`, except where this device has something newer
    /// (`isLocalNewer`); episodes out of scope keep their local entries.
    static func merge(
        local: ProgressMap,
        server: ProgressMap,
        inScope: (String) -> Bool,
        isLocalNewer: (String) -> Bool
    ) -> ProgressMap {
        var next: ProgressMap = [:]
        for (id, entry) in local where !inScope(id) || isLocalNewer(id) {
            next[id] = entry
        }
        for (id, entry) in server where next[id] == nil {
            next[id] = entry
        }
        return next
    }

    /// One card per book, most recent first: books changed on this device (worked out here, as the API would),
    /// then the API's list for the rest. Books and episodes no longer in the catalog are left out.
    static func continueWatching(
        progress: ProgressMap,
        touched: [String: Date],
        api: [APIProgress],
        book: (String) -> Book?,
        episode: (String) -> (book: Book, episode: Episode)?
    ) -> [ContinueItem] {
        let recent = touched.sorted { $0.value > $1.value }.map(\.key)
        let local: [ContinueItem] = recent.compactMap { bookID in
            guard let found = book(bookID), let next = continueEpisode(found, progress) else { return nil }
            return ContinueItem(book: found, episode: next, entry: progress[next.id])
        }
        let fromAPI: [ContinueItem] = api.filter { touched[$0.bookId] == nil }.compactMap { item in
            guard let found = episode(item.episodeId) else { return nil }
            return ContinueItem(book: found.book, episode: found.episode, entry: progress[item.episodeId] ?? item.entry)
        }
        return local + fromAPI
    }

    /// Finished series, most recently finished first: books changed here that are now finished, then the API's.
    static func finishedBooks(
        progress: ProgressMap,
        touched: [String: Date],
        api: [String],
        book: (String) -> Book?
    ) -> [Book] {
        let recent = touched.sorted { $0.value > $1.value }.map(\.key)
        let local = recent.compactMap(book).filter { isFinished($0, progress) }
        let fromAPI = api.filter { touched[$0] == nil }.compactMap(book)
        return local + fromAPI
    }
}
