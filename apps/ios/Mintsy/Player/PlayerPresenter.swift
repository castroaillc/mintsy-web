import Foundation
import Observation

/// Opens the player over the tabs, or explains that an episode needs Premium (the paywall isn't built yet).
@Observable
final class PlayerPresenter {
    var route: PlayerRoute?
    /// An episode that was asked for but needs Premium; nil once its notice is dismissed.
    var lockedEpisode: Episode?

    /// Never plays a locked episode, however it was opened.
    func open(_ episode: Episode) {
        if episode.locked {
            lockedEpisode = episode
        } else {
            route = PlayerRoute(episodeID: episode.id)
        }
    }

    func close() {
        route = nil
    }
}
