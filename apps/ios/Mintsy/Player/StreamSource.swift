import Foundation

/// What to stream: the HLS playlist when there is one (with the MP4 as its fallback), otherwise the MP4.
nonisolated struct StreamSource: Equatable, Sendable {
    let url: URL
    let fallback: URL?

    /// Nil when there's nothing to play. Mirrors the Expo app's `streamSources`.
    init?(videoUrl: URL?, hlsUrl: URL?, hlsEnabled: Bool) {
        if hlsEnabled, let hlsUrl {
            url = hlsUrl
            fallback = videoUrl
        } else if let videoUrl {
            url = videoUrl
            fallback = nil
        } else {
            return nil
        }
    }

    init?(episode: Episode, hlsEnabled: Bool) {
        self.init(videoUrl: episode.videoUrl, hlsUrl: episode.hlsUrl, hlsEnabled: hlsEnabled)
    }

    init?(voice: EpisodeVoice, hlsEnabled: Bool) {
        self.init(videoUrl: voice.videoUrl, hlsUrl: voice.hlsUrl, hlsEnabled: hlsEnabled)
    }
}
