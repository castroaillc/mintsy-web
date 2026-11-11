import Foundation

/// The paywall's presentation, with the episode the viewer was blocked on (Welcome offers to play it).
nonisolated struct PaywallRoute: Identifiable, Hashable, Sendable {
    let episodeID: String?

    var id: String { episodeID ?? "paywall" }
}
