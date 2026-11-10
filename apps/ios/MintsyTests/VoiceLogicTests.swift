import Foundation
import Testing
@testable import Mintsy

/// The cases of the Expo app's voice tests (git 75b0adc, `apps/mobile/scripts/voices.test.mjs`), so narrators switch
/// and captions show as they did there.
struct VoiceLogicTests {
    let heart = Timeline(lineStarts: [5, 20, 60, 100], durationSec: 120)
    // The longest voice: same line count, every line later
    let michael = Timeline(lineStarts: [5, 26, 80, 135], durationSec: 160)

    // MARK: Position conversion

    @Test func identicalTimelinesConvertToTheSamePosition() {
        for sec in [0, 3, 5, 44.5, 100, 119.9, 120] {
            #expect(VoiceLogic.convertPosition(sec, from: heart, to: heart) == sec)
        }
    }

    @Test func lineStartsMapToMatchingLineStartsBothWays() {
        for (index, start) in heart.lineStarts.enumerated() {
            #expect(VoiceLogic.convertPosition(start, from: heart, to: michael) == michael.lineStarts[index])
            #expect(VoiceLogic.convertPosition(michael.lineStarts[index], from: michael, to: heart) == start)
        }
    }

    @Test func interpolatesWithinALine() {
        #expect(VoiceLogic.convertPosition(53, from: michael, to: heart) == 40)
        #expect(VoiceLogic.convertPosition(40, from: heart, to: michael) == 53)
    }

    @Test func beforeTheFirstLineRunsFromEachStart() {
        let late = Timeline(lineStarts: [10, 30], durationSec: 60)
        let early = Timeline(lineStarts: [5, 20], durationSec: 40)
        #expect(VoiceLogic.convertPosition(0, from: late, to: early) == 0)
        #expect(VoiceLogic.convertPosition(5, from: late, to: early) == 2.5)
        #expect(VoiceLogic.convertPosition(2.5, from: early, to: late) == 5)
    }

    @Test func afterTheLastLineRunsToEachEnd() {
        #expect(VoiceLogic.convertPosition(147.5, from: michael, to: heart) == 110)
        #expect(VoiceLogic.convertPosition(160, from: michael, to: heart) == 120)
        #expect(VoiceLogic.convertPosition(120, from: heart, to: michael) == 160)
    }

    @Test func clampsAndBadNumbersGiveZero() {
        let empty = Timeline(lineStarts: [], durationSec: 0)
        #expect(VoiceLogic.convertPosition(-10, from: michael, to: heart) == 0)
        #expect(VoiceLogic.convertPosition(9999, from: michael, to: heart) == 120)
        #expect(VoiceLogic.convertPosition(.nan, from: michael, to: heart) == 0)
        #expect(VoiceLogic.convertPosition(.infinity, from: michael, to: heart) == 0)
        #expect(VoiceLogic.convertPosition(50, from: empty, to: heart) == 0)
        #expect(VoiceLogic.convertPosition(50, from: heart, to: empty) == 0)
    }

    @Test func differingLineCountsFallBackToProportion() {
        let other = Timeline(lineStarts: [1, 2], durationSec: 240)
        #expect(VoiceLogic.convertPosition(60, from: heart, to: other) == 120)
        #expect(VoiceLogic.convertPosition(120, from: other, to: heart) == 60)
        #expect(VoiceLogic.convertPosition(240, from: other, to: heart) == 120)
    }

    @Test func noLinesOrBackwardsLinesFallBackToProportion() {
        #expect(VoiceLogic.convertPosition(60, from: heart, to: Timeline(lineStarts: [], durationSec: 240)) == 120)
        let backwards = Timeline(lineStarts: [5, 2], durationSec: 120)
        #expect(VoiceLogic.convertPosition(60, from: backwards, to: Timeline(lineStarts: [1, 2], durationSec: 240)) == 120)
    }

    @Test func equalRoundedLineStartsNeverDivideByZero() {
        let a = Timeline(lineStarts: [0, 0, 7, 7, 7, 20], durationSec: 30)
        let b = Timeline(lineStarts: [0, 1, 8, 9, 10, 25], durationSec: 40)
        for sec in stride(from: 0.0, through: 30, by: 0.25) {
            let out = VoiceLogic.convertPosition(sec, from: a, to: b)
            #expect(out.isFinite && out >= 0 && out <= 40)
        }
        for sec in stride(from: 0.0, through: 40, by: 0.25) {
            #expect(VoiceLogic.convertPosition(sec, from: b, to: a).isFinite)
        }
    }

    @Test func conversionOnlyMovesForward() {
        var previous = -1.0
        for sec in stride(from: 0.0, through: 160, by: 0.25) {
            let out = VoiceLogic.convertPosition(sec, from: michael, to: heart)
            #expect(out >= previous)
            previous = out
        }
    }

    @Test func roundedLineStartPastTheRealEndStaysOnTheTimeline() {
        let real = Timeline(lineStarts: [5, 304], durationSec: 303.616)
        let defaultVoice = Timeline(lineStarts: [5, 250], durationSec: 260)
        #expect(VoiceLogic.convertPosition(303.616, from: real, to: defaultVoice) == 260)
        #expect(VoiceLogic.convertPosition(303, from: real, to: defaultVoice) <= 260)
    }

    // MARK: Switching voice

    @Test func switchingLandsOnTheStartOfTheMatchingLine() {
        #expect(VoiceLogic.switchPosition(30, from: heart, to: michael) == 26)
        #expect(VoiceLogic.switchPosition(20, from: heart, to: michael) == 26)
        #expect(VoiceLogic.switchPosition(119, from: heart, to: michael) == 135)
    }

    @Test func switchingUsesTheExactPhraseTimeNearARoundedLineStart() {
        let captions = [
            CaptionPhrase(startSec: 25.6, endSec: 27, text: "a"),
            CaptionPhrase(startSec: 27.1, endSec: 29, text: "b"),
        ]
        #expect(VoiceLogic.switchPosition(30, from: heart, to: michael, toCaptions: captions) == 25.6)
        #expect(VoiceLogic.switchPosition(30, from: heart, to: michael, toCaptions: [CaptionPhrase(startSec: 40, endSec: 41, text: "far")]) == 26)
    }

    @Test func switchingInTheIntroStaysProportional() {
        #expect(VoiceLogic.switchPosition(2.5, from: Timeline(lineStarts: [10], durationSec: 20), to: Timeline(lineStarts: [20], durationSec: 40)) == 5)
        #expect(VoiceLogic.switchPosition(60, from: heart, to: Timeline(lineStarts: [1], durationSec: 240)) == 120)
    }

    // MARK: Captions

    let phrases = VoiceLogic.normalizeCaptions([
        CaptionPhrase(startSec: 4.8, endSec: 6, text: "He said, \"First"),
        CaptionPhrase(startSec: 6, endSec: 7.5, text: "and last.\""),
        CaptionPhrase(startSec: 9, endSec: 10, text: "After a gap."),
        CaptionPhrase(startSec: 11, endSec: 11, text: "zero length"),
        CaptionPhrase(startSec: 20, endSec: 21, text: "Far on."),
    ])

    @Test func noCaptionInTheIntroThenASmallLeadIn() {
        #expect(VoiceLogic.activeCaption(phrases, at: 0) == nil)
        #expect(VoiceLogic.activeCaption(phrases, at: 4.6) == nil)
        #expect(VoiceLogic.activeCaption(phrases, at: 4.7)?.text == "He said, \"First")
    }

    @Test func touchingPhrasesHandOverWithoutAGap() {
        #expect(VoiceLogic.activeCaption(phrases, at: 5.87)?.text == "He said, \"First")
        #expect(VoiceLogic.activeCaption(phrases, at: 5.9)?.text == "and last.\"")
    }

    @Test func lingersAcrossAShortGapAndClearsAfterALongOne() {
        #expect(VoiceLogic.activeCaption(phrases, at: 8.2)?.text == "and last.\"")
        #expect(VoiceLogic.activeCaption(phrases, at: 8.89)?.text == "After a gap.")
        #expect(VoiceLogic.activeCaption(phrases, at: 10.5)?.text == "After a gap.")
        #expect(VoiceLogic.activeCaption(phrases, at: 11) == nil)
        #expect(VoiceLogic.activeCaption(phrases, at: 15) == nil)
    }

    @Test func afterTheLastPhraseThereIsNothing() {
        #expect(VoiceLogic.activeCaption(phrases, at: 21.5)?.text == "Far on.")
        #expect(VoiceLogic.activeCaption(phrases, at: 21.8) == nil)
        #expect(VoiceLogic.activeCaption(phrases, at: 500) == nil)
    }

    @Test func badPhrasesAreDroppedAndOrderIsFixed() {
        let cleaned = VoiceLogic.normalizeCaptions([
            CaptionPhrase(startSec: 3, endSec: 3, text: "zero"),
            CaptionPhrase(startSec: 5, endSec: 4, text: "reversed"),
            CaptionPhrase(startSec: 6, endSec: 7, text: "  "),
            CaptionPhrase(startSec: 2, endSec: 2.5, text: "b"),
            CaptionPhrase(startSec: 1, endSec: 1.5, text: "a"),
        ])
        #expect(cleaned.map(\.text) == ["a", "b"])
        #expect(VoiceLogic.activeCaption([], at: 3) == nil)
        #expect(VoiceLogic.activeCaption(phrases, at: .nan) == nil)
    }

    // MARK: Choosing a voice

    func voice(_ id: String, isDefault: Bool = false, video: Bool = true, hls: Bool = false) -> EpisodeVoice {
        EpisodeVoice(
            id: id, name: id.uppercased(), isDefault: isDefault,
            videoUrl: video ? URL(string: "https://media.test/\(id).mp4") : nil,
            hlsUrl: hls ? URL(string: "https://media.test/\(id).m3u8") : nil,
            durationSec: 100
        )
    }

    @Test func thePreferenceIsUsedWhenOfferedOtherwiseTheDefault() {
        let voices = [voice("a", isDefault: true), voice("b")]
        #expect(VoiceLogic.chooseVoice(voices, preferredID: "b", hlsEnabled: false)?.id == "b")
        #expect(VoiceLogic.chooseVoice(voices, preferredID: "gone", hlsEnabled: false)?.id == "a")
        #expect(VoiceLogic.chooseVoice(voices, preferredID: nil, hlsEnabled: false)?.id == "a")
        #expect(VoiceLogic.chooseVoice([], preferredID: "b", hlsEnabled: false) == nil)
    }

    @Test func aVoiceWhoseSigningFailedIsNotChosen() {
        #expect(VoiceLogic.chooseVoice([voice("a", isDefault: true), voice("b", video: false)], preferredID: "b", hlsEnabled: false)?.id == "a")
        #expect(VoiceLogic.chooseVoice([voice("a", isDefault: true, video: false)], preferredID: nil, hlsEnabled: false) == nil)
    }

    @Test func streamsFollowTheHLSRules() {
        let both = voice("a", hls: true)
        #expect(StreamSource(voice: both, hlsEnabled: true)?.url.lastPathComponent == "a.m3u8")
        #expect(StreamSource(voice: both, hlsEnabled: true)?.fallback?.lastPathComponent == "a.mp4")
        #expect(StreamSource(voice: both, hlsEnabled: false)?.url.lastPathComponent == "a.mp4")
        #expect(StreamSource(voice: both, hlsEnabled: false)?.fallback == nil)
        let hlsOnly = voice("a", isDefault: true, video: false, hls: true)
        #expect(VoiceLogic.chooseVoice([hlsOnly], preferredID: nil, hlsEnabled: false) == nil)
        #expect(VoiceLogic.chooseVoice([hlsOnly], preferredID: nil, hlsEnabled: true)?.id == "a")
    }

    @Test func voicesWithoutADefaultAreTreatedAsNone() {
        #expect(VoiceLogic.normalizeVoices([voice("a"), voice("b")]).isEmpty)
        #expect(VoiceLogic.normalizeVoices([voice("a", isDefault: true), voice("b")]).count == 2)
    }

    // MARK: Transcript

    @Test func activeLineIsTheLastLineStarted() {
        let lines = [TranscriptLine(startSec: 5, text: "a"), TranscriptLine(startSec: 8, text: "b"), TranscriptLine(startSec: 12, text: "c")]
        #expect(VoiceLogic.activeLineIndex(lines, at: 0) == 0)
        #expect(VoiceLogic.activeLineIndex(lines, at: 8) == 1)
        #expect(VoiceLogic.activeLineIndex(lines, at: 11.9) == 1)
        #expect(VoiceLogic.activeLineIndex(lines, at: 99) == 2)
        #expect(VoiceLogic.activeLineIndex([], at: 3) == 0)
    }
}
