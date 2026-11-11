import AVFoundation
import SwiftUI

/// The full-screen player for an episode id. Moving to another episode (previous, next, autoplay, Up next) happens
/// in place, so the cover stays open.
struct PlayerScreen: View {
    let route: PlayerRoute

    @Environment(CatalogStore.self) private var catalog
    @Environment(PlayerPresenter.self) private var presenter
    @Environment(ProgressStore.self) private var progress
    @Environment(\.graphQL) private var graphQL
    @Environment(\.appConfig) private var config
    @State private var episodeID: String?
    @State private var model: PlayerModel?
    @State private var nowPlayingCoordinator = NowPlayingCoordinator()

    private var currentID: String { episodeID ?? route.episodeID }

    var body: some View {
        @Bindable var presenter = presenter
        Group {
            if let model, model.episode.id == currentID {
                PlayerView(model: model, onSelectEpisode: select, onClose: presenter.close)
            } else if catalog.episode(id: currentID) == nil, catalog.status != .loading {
                ContentUnavailableView {
                    Label("Episode not found", systemImage: "play.slash")
                } actions: {
                    Button("Close", action: presenter.close)
                        .buttonStyle(.brand(height: 48))
                        .frame(maxWidth: 240)
                }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Palette.background)
        .task(id: currentID) { await startEpisode(currentID) }
        .onDisappear {
            model?.stop()
            nowPlayingCoordinator.stop()
        }
        .fullScreenCover(item: $presenter.playerPaywall) { route in
            PaywallFlow(route: route, onClose: presenter.closePaywall, onPlay: playUnlocked, onHome: presenter.goHome)
        }
    }

    private func startEpisode(_ id: String) async {
        guard let found = catalog.episode(id: id) else { return }
        model?.stop()
        // The route's start point is for the episode it opened on; others resume from saved progress
        let startSec = id == route.episodeID && episodeID == nil ? route.startSec : nil
        let next = PlayerModel(
            book: found.book, episode: found.episode, client: graphQL, hlsEnabled: config?.hlsEnabled ?? false,
            progress: progress, startSec: startSec
        )
        next.onAdvance = { episode in select(episode) }
        next.onLockedNext = { episode in select(episode) }
        model = next
        activateAudioSession()
        nowPlayingCoordinator.start(model: next)
        await next.start()
    }

    /// Previous, next and Up next. A Premium-only episode opens the paywall instead of playing.
    private func select(_ episode: Episode) {
        if episode.locked {
            presenter.showPaywall(for: episode)
        } else {
            episodeID = episode.id
        }
    }

    /// Welcome to Premium's Play button: the episode the viewer was blocked on, now unlocked, in this player.
    private func playUnlocked(_ episode: Episode) {
        presenter.closePaywall()
        select(episode)
    }

    /// Plays with the silent switch on, like any video app.
    private func activateAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .moviePlayback)
        try? session.setActive(true)
    }
}
