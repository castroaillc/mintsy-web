import Foundation

/// Catalog-wide averages over books with episodes, for onboarding's daily-time step (the Expo app's
/// `catalogAverages`).
nonisolated struct CatalogAverages: Equatable, Sendable {
    /// Episodes per book, rounded.
    let episodesPerBook: Int
    /// Episode length in whole minutes, at least 1.
    let episodeMinutes: Int

    init(episodesPerBook: Int, episodeMinutes: Int) {
        self.episodesPerBook = episodesPerBook
        self.episodeMinutes = episodeMinutes
    }

    /// Nil when the catalog has no episode with a known length.
    init?(books: [Book]) {
        let withEpisodes = books.filter { !$0.episodes.isEmpty }
        let durations = withEpisodes.flatMap(\.episodes).map(\.durationSec).filter { $0 > 0 }
        guard !durations.isEmpty else { return nil }
        let averageSec = Double(durations.reduce(0, +)) / Double(durations.count)
        let total = withEpisodes.reduce(0) { $0 + $1.episodes.count }
        episodeMinutes = max(1, Int((averageSec / 60).rounded()))
        episodesPerBook = Int((Double(total) / Double(withEpisodes.count)).rounded())
    }

    /// Episodes that fit in `minutes` a day, at least 1.
    func episodesPerDay(minutes: Int) -> Int {
        max(1, Int((Double(minutes) / Double(episodeMinutes)).rounded()))
    }
}
