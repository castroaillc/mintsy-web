import Foundation

/// Labels shared by the screens, matching the Expo app's `src/lib/series.ts`.
nonisolated enum SeriesFormat {
    /// 312 → "5:12"
    static func time(_ totalSec: Double) -> String {
        let sec = max(0, Int(totalSec.isFinite ? totalSec.rounded(.down) : 0))
        let seconds = sec % 60
        return "\(sec / 60):\(seconds < 10 ? "0" : "")\(seconds)"
    }

    /// 6060 → "1 hr 41 min"
    static func runtime(_ totalSec: Int) -> String {
        let minutes = Int((Double(totalSec) / 60).rounded())
        let hours = minutes / 60
        return hours > 0 ? "\(hours) hr \(minutes % 60) min" : "\(minutes) min"
    }

    /// "Episode 3 of 12"
    static func episodeLabel(_ episode: Episode, in book: Book) -> String {
        "Episode \(episode.number) of \(book.episodes.count)"
    }

    static func totalRuntime(_ book: Book) -> Int {
        book.episodes.reduce(0) { $0 + $1.durationSec }
    }

    /// Average episode length in whole minutes (at least 1), or nil when no durations are known.
    static func averageEpisodeMinutes(_ book: Book) -> Int? {
        let known = book.episodes.filter { $0.durationSec > 0 }
        guard !known.isEmpty else { return nil }
        let average = Double(known.reduce(0) { $0 + $1.durationSec }) / Double(known.count)
        return max(1, Int((average / 60).rounded()))
    }

    /// Search on Home: title, author or category contains the query.
    static func matches(_ book: Book, query: String) -> Bool {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return true }
        return [book.title, book.author, book.category].contains { $0.localizedStandardContains(trimmed) }
    }
}
