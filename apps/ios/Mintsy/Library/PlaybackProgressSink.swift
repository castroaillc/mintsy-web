import Foundation

/// Where the player reports the viewer's place. Positions are whole seconds on the default voice's timeline.
protocol PlaybackProgressSink: AnyObject {
    /// The episode's saved place, if any.
    func entry(for episodeID: String) -> EpisodeProgress?
    /// Shows at once; reaches the API within a few seconds, or right away with `saveNow` (a seek).
    func setPosition(_ episodeID: String, positionSec: Int, saveNow: Bool)
    func markCompleted(_ episodeID: String)
    /// Sends what's waiting now (pause, leaving the app).
    func saveNow()
    /// Sends what's waiting, then reloads from the API (leaving the player).
    func sync() async
}
