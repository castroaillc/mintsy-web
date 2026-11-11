import Foundation
import Observation

/// Opens the player over the tabs, or the paywall when an episode needs Premium.
@Observable
final class PlayerPresenter {
    var route: PlayerRoute?
    /// The paywall over the tabs.
    var paywall: PaywallRoute?
    /// The paywall over the open player (Up next, or the next episode when one ends).
    var playerPaywall: PaywallRoute?
    /// Counts requests to show Home (Welcome to Premium's "Go to Home").
    private(set) var homeRequests = 0

    /// The episode to play once the paywall over the tabs has closed.
    @ObservationIgnored private var playAfterPaywall: Episode?

    /// Never plays a locked episode, however it was opened: the paywall opens instead. `startSec` overrides the saved
    /// place (a search match).
    func open(_ episode: Episode, at startSec: Double? = nil) {
        if episode.locked {
            showPaywall(for: episode)
        } else {
            route = PlayerRoute(episodeID: episode.id, startSec: startSec)
        }
    }

    func close() {
        route = nil
    }

    /// Opens the paywall over whatever is showing. `episode` is the one the viewer was blocked on, if any.
    func showPaywall(for episode: Episode? = nil) {
        let paywall = PaywallRoute(episodeID: episode?.id)
        if route == nil {
            self.paywall = paywall
        } else {
            playerPaywall = paywall
        }
    }

    func closePaywall() {
        paywall = nil
        playerPaywall = nil
    }

    /// Welcome to Premium's Play button, over the tabs: the player opens once the paywall has gone.
    func playAfterPaywall(_ episode: Episode) {
        playAfterPaywall = episode
        paywall = nil
    }

    /// The paywall over the tabs finished closing.
    func paywallDismissed() {
        guard let episode = playAfterPaywall else { return }
        playAfterPaywall = nil
        open(episode)
    }

    /// Closes the paywall and the player, and asks the tabs for Home.
    func goHome() {
        closePaywall()
        route = nil
        homeRequests += 1
    }
}
