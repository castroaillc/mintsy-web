import Foundation

/// One episode (a chapter as a video). `id` is `<bookId>-<number>`.
nonisolated struct Episode: Decodable, Equatable, Hashable, Sendable, Identifiable {
    let id: String
    let number: Int
    let title: String
    let summary: String
    let durationSec: Int
    /// Empty when locked.
    let transcript: [TranscriptLine]
    /// Empty when locked.
    let takeaways: [String]
    /// Progressive MP4. Nil until uploaded, and when locked. May be a short-lived signed URL.
    let videoUrl: URL?
    /// HLS playlist. Only asked for when HLS is enabled; nil when locked or without an HLS encode.
    let hlsUrl: URL?
    let thumbnailUrl: URL?
    /// The viewer needs Premium to watch this (free tier, number > `SharedConstants.freeEpisodes`).
    let locked: Bool

    init(
        id: String, number: Int, title: String, summary: String = "", durationSec: Int,
        transcript: [TranscriptLine] = [], takeaways: [String] = [], videoUrl: URL? = nil, hlsUrl: URL? = nil,
        thumbnailUrl: URL? = nil, locked: Bool = false
    ) {
        self.id = id
        self.number = number
        self.title = title
        self.summary = summary
        self.durationSec = durationSec
        self.transcript = transcript
        self.takeaways = takeaways
        self.videoUrl = videoUrl
        self.hlsUrl = hlsUrl
        self.thumbnailUrl = thumbnailUrl
        self.locked = locked
    }

    private enum CodingKeys: String, CodingKey {
        case id, number, title, summary, durationSec, transcript, takeaways, videoUrl, hlsUrl, thumbnailUrl, locked
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        number = try c.decode(Int.self, forKey: .number)
        title = try c.decode(String.self, forKey: .title)
        summary = try c.decodeIfPresent(String.self, forKey: .summary) ?? ""
        durationSec = try c.decode(Int.self, forKey: .durationSec)
        transcript = try c.decodeIfPresent([TranscriptLine].self, forKey: .transcript) ?? []
        takeaways = try c.decodeIfPresent([String].self, forKey: .takeaways) ?? []
        videoUrl = try c.decodeIfPresent(URL.self, forKey: .videoUrl)
        hlsUrl = try c.decodeIfPresent(URL.self, forKey: .hlsUrl)
        thumbnailUrl = try c.decodeIfPresent(URL.self, forKey: .thumbnailUrl)
        locked = try c.decodeIfPresent(Bool.self, forKey: .locked) ?? false
    }
}
