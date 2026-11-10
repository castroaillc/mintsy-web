import AVFoundation
import SwiftUI

/// The full-screen player for an episode id. Moving to another episode (previous, next, autoplay, Up next) happens
/// in place, so the cover stays open.
struct PlayerScreen: View {
    let route: PlayerRoute

    @Environment(CatalogStore.self) private var catalog
    @Environment(PlayerPresenter.self) private var presenter
    @Environment(\.graphQL) private var graphQL
    @Environment(\.appConfig) private var config
    @State private var episodeID: String?
    @State private var model: PlayerModel?
    @State private var lockedEpisode: Episode?

    private var currentID: String { episodeID ?? route.episodeID }

    var body: some View {
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
        .onDisappear { model?.stop() }
        .alert("Premium episode", item: $lockedEpisode) { _ in
            Button("OK", role: .cancel) {}
        } message: { episode in
            Text("Episode \(episode.number) is part of Premium. Subscribing isn’t in the native app yet.")
        }
    }

    private func startEpisode(_ id: String) async {
        guard let found = catalog.episode(id: id) else { return }
        model?.stop()
        let next = PlayerModel(book: found.book, episode: found.episode, client: graphQL, hlsEnabled: config?.hlsEnabled ?? false)
        next.onAdvance = { episode in select(episode) }
        model = next
        activateAudioSession()
        await next.start()
    }

    /// Previous, next and Up next. A Premium-only episode explains itself instead of playing.
    private func select(_ episode: Episode) {
        if episode.locked {
            lockedEpisode = episode
        } else {
            episodeID = episode.id
        }
    }

    /// Plays with the silent switch on, like any video app.
    private func activateAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .moviePlayback)
        try? session.setActive(true)
    }
}
