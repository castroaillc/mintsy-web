import SwiftUI

/// The paywall, then Welcome to Premium once the viewer subscribes (designs 18 and 19). Presented over the tabs or
/// over the player; the presenter decides what closing, playing and going home mean there.
struct PaywallFlow: View {
    let route: PaywallRoute
    let onClose: () -> Void
    /// Plays the episode the viewer was blocked on, now that it's unlocked.
    let onPlay: (Episode) -> Void
    let onHome: () -> Void

    @State private var isSubscribed = false

    var body: some View {
        Group {
            if isSubscribed {
                PremiumWelcomeView(episodeID: route.episodeID, onPlay: onPlay, onHome: onHome, onClose: onClose)
            } else {
                PaywallView(route: route, onClose: onClose, onSubscribed: showWelcome)
            }
        }
        .background(Palette.background)
    }

    private func showWelcome() {
        isSubscribed = true
    }
}
