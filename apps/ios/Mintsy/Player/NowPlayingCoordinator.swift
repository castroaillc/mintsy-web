import MediaPlayer
import UIKit

/// Keeps the lock screen / Control Center Now Playing widget in sync with the active episode and
/// routes remote commands (AirPods, Bluetooth, lock screen controls) back to the engine.
///
/// Lifetime: one coordinator per PlayerScreen, started when an episode begins and stopped when
/// the screen disappears. start(model:) tears down any previous session automatically, so episode
/// navigation does not require an explicit stop().
final class NowPlayingCoordinator {
    // nonisolated(unsafe) lets deinit cancel these without crossing the actor boundary.
    nonisolated(unsafe) private var observationTask: Task<Void, Never>?
    nonisolated(unsafe) private var artworkTask: Task<Void, Never>?

    deinit {
        observationTask?.cancel()
        artworkTask?.cancel()
    }

    // MARK: Public interface

    func start(model: PlayerModel) {
        stop()
        registerCommands(engine: model.engine)
        startArtworkFetch(episode: model.episode, book: model.book)
        observationTask = Task { [weak self] in
            self?.publish(model: model)
            while !Task.isCancelled {
                await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
                    withObservationTracking {
                        _ = model.engine.positionSec
                        _ = model.engine.isPlaying
                        _ = model.engine.durationSec
                        _ = model.engine.speed
                    } onChange: {
                        cont.resume()
                    }
                }
                if Task.isCancelled { break }
                self?.publish(model: model)
            }
        }
    }

    func stop() {
        observationTask?.cancel()
        artworkTask?.cancel()
        observationTask = nil
        artworkTask = nil
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        removeCommands()
    }

    // MARK: Now Playing info

    private func publish(model: PlayerModel) {
        let rate = model.engine.isPlaying ? Double(model.engine.speed) : 0.0
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: model.episode.title,
            MPMediaItemPropertyArtist: model.book.author,
            MPMediaItemPropertyAlbumTitle: model.book.title,
            MPMediaItemPropertyPlaybackDuration: model.engine.durationSec,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: model.engine.positionSec,
            MPNowPlayingInfoPropertyPlaybackRate: rate,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
        ]
        // Preserve artwork loaded asynchronously; avoids blanking it on each position tick.
        if let artwork = MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPMediaItemPropertyArtwork] {
            info[MPMediaItemPropertyArtwork] = artwork
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func startArtworkFetch(episode: Episode, book: Book) {
        let url = episode.thumbnailUrl ?? book.coverUrl
        guard let url else { return }
        artworkTask = Task {
            guard let (data, _) = try? await URLSession.shared.data(from: url),
                  let image = UIImage(data: data) else { return }
            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            guard var info = MPNowPlayingInfoCenter.default().nowPlayingInfo else { return }
            info[MPMediaItemPropertyArtwork] = artwork
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        }
    }

    // MARK: Remote commands

    private func registerCommands(engine: PlaybackEngine) {
        let center = MPRemoteCommandCenter.shared()

        center.playCommand.addTarget { [weak engine] _ in
            Task { @MainActor [weak engine] in engine?.play() }
            return .success
        }
        center.pauseCommand.addTarget { [weak engine] _ in
            Task { @MainActor [weak engine] in engine?.pause() }
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak engine] _ in
            Task { @MainActor [weak engine] in engine?.togglePlay() }
            return .success
        }
        center.skipBackwardCommand.preferredIntervals = [10]
        center.skipBackwardCommand.addTarget { [weak engine] _ in
            Task { @MainActor [weak engine] in engine?.skip(by: -10) }
            return .success
        }
        center.skipForwardCommand.preferredIntervals = [10]
        center.skipForwardCommand.addTarget { [weak engine] _ in
            Task { @MainActor [weak engine] in engine?.skip(by: 10) }
            return .success
        }
        center.changePlaybackPositionCommand.addTarget { [weak engine] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            let position = event.positionTime
            Task { @MainActor [weak engine] in engine?.seek(to: position) }
            return .success
        }
    }

    private func removeCommands() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.removeTarget(nil)
        center.pauseCommand.removeTarget(nil)
        center.togglePlayPauseCommand.removeTarget(nil)
        center.skipBackwardCommand.removeTarget(nil)
        center.skipForwardCommand.removeTarget(nil)
        center.changePlaybackPositionCommand.removeTarget(nil)
    }
}
