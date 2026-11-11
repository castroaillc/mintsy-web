import Foundation

/// One narrator's full render of an episode, from `episodeVoices` (never the catalog). Its transcript, captions and
/// duration are on this voice's own timeline. URLs may be short-lived: don't store them.
nonisolated struct EpisodeVoice: Decodable, Equatable, Hashable, Sendable, Identifiable {
    let id: String
    let name: String
    /// The voice that `Episode.videoUrl`, `hlsUrl`, `durationSec` and `transcript` describe.
    let isDefault: Bool
    /// Nil if signing failed.
    let videoUrl: URL?
    /// Nil without an HLS encode, and always while media is private.
    let hlsUrl: URL?
    let durationSec: Int
    let transcript: [TranscriptLine]
    let captions: [CaptionPhrase]

    init(
        id: String, name: String, isDefault: Bool, videoUrl: URL?, hlsUrl: URL? = nil, durationSec: Int,
        transcript: [TranscriptLine] = [], captions: [CaptionPhrase] = []
    ) {
        self.id = id
        self.name = name
        self.isDefault = isDefault
        self.videoUrl = videoUrl
        self.hlsUrl = hlsUrl
        self.durationSec = durationSec
        self.transcript = transcript
        self.captions = captions
    }

    var timeline: Timeline { Timeline(transcript: transcript, durationSec: Double(durationSec)) }
}
