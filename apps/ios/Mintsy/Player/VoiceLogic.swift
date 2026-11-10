import Foundation

/// Narrator logic, ported from the Expo app (git 75b0adc, `apps/mobile/src/lib/voices.ts`) and checked by the same
/// cases in `VoiceLogicTests`. An episode can have one full render per voice, each on its own timeline.
/// `Episode.videoUrl`, `durationSec` and `transcript` describe the default voice.
nonisolated enum VoiceLogic {
    /// Captions come up this long before the first word, and stay up to this long after the last (what burned-in
    /// captions did in studio `src/collage/polish.tsx`).
    static let captionLeadInSec = 0.12
    static let captionLingerSec = 0.8

    /// A phrase starting within this many seconds of a (rounded) line start is the same moment, with the exact time.
    static let lineSnapSec = 0.6

    // MARK: Cleaning up the API's answer

    /// Phrases in time order, without zero-length or empty ones (they would flash). Text is untouched.
    static func normalizeCaptions(_ phrases: [CaptionPhrase]) -> [CaptionPhrase] {
        phrases
            .filter { $0.startSec.isFinite && $0.endSec.isFinite && $0.endSec > $0.startSec && !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .sorted { $0.startSec < $1.startSec }
    }

    /// Voices with clean captions. With no default voice left it's handled as an episode without voices: `[]`.
    static func normalizeVoices(_ voices: [EpisodeVoice]) -> [EpisodeVoice] {
        let cleaned = voices.map {
            EpisodeVoice(
                id: $0.id, name: $0.name, isDefault: $0.isDefault, videoUrl: $0.videoUrl, hlsUrl: $0.hlsUrl,
                durationSec: $0.durationSec, transcript: $0.transcript, captions: normalizeCaptions($0.captions)
            )
        }
        return cleaned.contains(where: \.isDefault) ? cleaned : []
    }

    // MARK: Choosing a voice

    /// Whether a voice can be streamed. URLs are nil when signing failed, and those voices can't be offered.
    static func isPlayable(_ voice: EpisodeVoice, hlsEnabled: Bool) -> Bool {
        voice.videoUrl != nil || (hlsEnabled && voice.hlsUrl != nil)
    }

    /// The stored preference when this episode offers it, else the episode's default, else nil (play the catalog's source).
    static func chooseVoice(_ voices: [EpisodeVoice], preferredID: String?, hlsEnabled: Bool) -> EpisodeVoice? {
        let playable = voices.filter { isPlayable($0, hlsEnabled: hlsEnabled) }
        return playable.first { $0.id == preferredID } ?? playable.first(where: \.isDefault)
    }

    // MARK: Timelines

    /// The same moment on another voice's timeline: lines are matched by index, interpolating within a line. Before
    /// the first line runs from each timeline's start to that line, and after the last one to each timeline's end.
    /// Mismatched or unusable lines fall back to the proportion of the duration.
    static func convertPosition(_ sec: Double, from: Timeline, to: Timeline) -> Double {
        let toEnd = to.durationSec.isFinite ? max(0, to.durationSec) : 0
        let fromEnd = from.durationSec.isFinite ? max(0, from.durationSec) : 0
        guard toEnd > 0, fromEnd > 0, sec.isFinite else { return 0 }
        let at = min(max(sec, 0), fromEnd)
        guard from.linesMatch(to) else { return at / fromEnd * toEnd }

        // Rounded line starts can land just past the real end
        let fromPoints = [0] + from.lineStarts.map { min($0, fromEnd) } + [fromEnd]
        let toPoints = [0] + to.lineStarts.map { min($0, toEnd) } + [toEnd]
        var index = fromPoints.count - 1
        while index > 0 && fromPoints[index] > at { index -= 1 }
        if index == fromPoints.count - 1 { return toEnd }
        let span = fromPoints[index + 1] - fromPoints[index]
        let share = span > 0 ? (at - fromPoints[index]) / span : 0
        return min(max(toPoints[index] + share * (toPoints[index + 1] - toPoints[index]), 0), toEnd)
    }

    /// Where to land after switching voice: the start of the sentence being spoken, in the new voice. Before the
    /// first line, and when lines can't be matched, it's the converted position.
    static func switchPosition(_ sec: Double, from: Timeline, to: Timeline, toCaptions: [CaptionPhrase] = []) -> Double {
        let converted = convertPosition(sec, from: from, to: to)
        guard from.linesMatch(to), sec.isFinite,
              let line = from.lineStarts.lastIndex(where: { $0 <= sec }) else { return converted }
        let end = max(0, to.durationSec)
        let lineStart = min(max(to.lineStarts[line], 0), end)
        var best = lineStart
        var bestDistance = lineSnapSec
        for phrase in toCaptions {
            let distance = abs(phrase.startSec - lineStart)
            if distance <= bestDistance {
                best = phrase.startSec
                bestDistance = distance
            }
        }
        return min(max(best, 0), end)
    }

    // MARK: Captions and transcript

    /// The phrase on screen at `sec`, or nil: during the intro, in gaps longer than the linger, after the last
    /// phrase. `phrases` must have come through `normalizeCaptions`. The next phrase always takes over.
    static func activeCaption(_ phrases: [CaptionPhrase], at sec: Double) -> CaptionPhrase? {
        guard sec.isFinite else { return nil }
        var low = 0
        var high = phrases.count - 1
        var index = -1
        while low <= high {
            let mid = (low + high) / 2
            if phrases[mid].startSec - captionLeadInSec <= sec {
                index = mid
                low = mid + 1
            } else {
                high = mid - 1
            }
        }
        guard index >= 0 else { return nil }
        let phrase = phrases[index]
        return sec < phrase.endSec + captionLingerSec ? phrase : nil
    }

    /// Index of the transcript line playing at `sec` (0 before the first line).
    static func activeLineIndex(_ transcript: [TranscriptLine], at sec: Double) -> Int {
        transcript.lastIndex { Double($0.startSec) <= sec } ?? 0
    }
}
