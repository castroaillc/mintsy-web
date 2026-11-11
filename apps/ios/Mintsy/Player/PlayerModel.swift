import Foundation
import Observation

/// One episode's playback, with its narrators, as the Expo player (`src/app/(app)/player/[episodeId].tsx`) did it.
///
/// Starting: a viewer with no preferred narrator starts on the catalog's source at once, because that's the default
/// voice. With one, the source waits for `episodeVoices` for at most `startWait`. An answer that comes after playback
/// has started adds the picker and captions but doesn't change the voice being heard. Without voices (a failed, slow
/// or empty answer) this is the catalog's source and nothing else changes.
@Observable
final class PlayerModel {
    /// How long playback may wait for a viewer with a preferred narrator.
    static let startWait: Duration = .milliseconds(1500)
    /// A slower answer counts as failed.
    static let loadTimeout: Duration = .seconds(10)
    /// A refetch happens in front of the viewer (switching voice, a failed URL), so it gets less time.
    static let refetchTimeout: Duration = .seconds(3)
    /// URLs can be signed and short-lived, so don't switch to one fetched longer ago than this.
    static let staleAfter: Duration = .seconds(5 * 60)
    /// How long the controls stay up after the last touch while a video plays.
    static let controlsAutoHide: Duration = .milliseconds(3500)
    /// How long playback must stay stopped before the controls come back by themselves.
    static let pauseRevealDelay: Duration = .milliseconds(250)

    let book: Book
    let episode: Episode
    let engine: PlaybackEngine
    /// False for an episode without an uploaded video.
    let hasStream: Bool

    /// The episode's narrators. Empty until (and unless) `episodeVoices` answers with some.
    private(set) var voices: [EpisodeVoice] = []
    /// Nil follows the default voice, whose media is what the catalog points at.
    private(set) var selectedVoiceID: String?
    /// The first answer from `episodeVoices` is in, or the start wait ran out.
    private(set) var voicesSettled = false
    var captionsOn: Bool
    private(set) var activeLineIndex = 0
    private(set) var activeCaption: CaptionPhrase?
    private(set) var controlsVisible = true
    var isScrubbing = false {
        didSet { refreshControls() }
    }
    var isVoiceOverRunning = false {
        didSet { refreshControls() }
    }

    @ObservationIgnored private let loader: EpisodeVoicesLoader
    @ObservationIgnored private let hlsEnabled: Bool
    @ObservationIgnored private let preferences: PlayerPreferences
    @ObservationIgnored private let catalogSource: StreamSource?
    @ObservationIgnored private var begun = false
    @ObservationIgnored private var fetchedAt: ContinuousClock.Instant?
    @ObservationIgnored private var lastRecovery: ContinuousClock.Instant?
    @ObservationIgnored private var hideTask: Task<Void, Never>?
    /// Where the viewer's place is saved (nil in previews).
    @ObservationIgnored private let progress: (any PlaybackProgressSink)?
    /// Where playback starts, on the default voice's timeline: an explicit point (a search match) or the saved place.
    @ObservationIgnored private let startSec: Double
    /// The last whole second reported, so each one is saved once.
    @ObservationIgnored private var lastReportedSec: Int?
    /// Opens the next episode (autoplay).
    @ObservationIgnored var onAdvance: ((Episode) -> Void)?
    /// Called when the episode ends and the next one needs Premium.
    @ObservationIgnored var onLockedNext: ((Episode) -> Void)?

    init(
        book: Book, episode: Episode, client: GraphQLClient?, hlsEnabled: Bool,
        progress: (any PlaybackProgressSink)? = nil, startSec: Double? = nil,
        preferences: PlayerPreferences = PlayerPreferences()
    ) {
        self.book = book
        self.episode = episode
        self.progress = progress
        // Resume where the viewer left off; watched or new episodes start at the top
        self.startSec = startSec ?? ProgressLogic.resumePosition(progress?.entry(for: episode.id))
        self.hlsEnabled = hlsEnabled
        self.preferences = preferences
        loader = EpisodeVoicesLoader(client: client)
        catalogSource = StreamSource(episode: episode, hlsEnabled: hlsEnabled)
        hasStream = catalogSource != nil
        captionsOn = preferences.captionsByDefault
        engine = PlaybackEngine(durationSec: Double(episode.durationSec))
        engine.onTick = { [weak self] sec in self?.positionChanged(sec) }
        engine.onStateChange = { [weak self] in self?.playbackStateChanged() }
        engine.onEnd = { [weak self] in self?.episodeEnded() }
        engine.onFailure = { [weak self] in self?.sourceFailed() }
    }

    // MARK: Derived

    /// The voice being heard: the chosen one, or the default.
    var selectedVoice: EpisodeVoice? {
        voices.first { $0.id == selectedVoiceID } ?? voices.first(where: \.isDefault)
    }

    /// Everything on screen is on the selected voice's timeline.
    var transcript: [TranscriptLine] { selectedVoice?.transcript ?? episode.transcript }

    var phrases: [CaptionPhrase] { selectedVoice?.captions ?? [] }

    /// The narrators that can be played. The picker shows only when there's a choice.
    var voiceOptions: [EpisodeVoice] { voices.filter { source(for: $0) != nil } }

    /// Captions on but no timed phrases (an episode without voices, whose captions are in the picture): the older
    /// transcript line along the top instead, once it's known.
    var showsTranscriptOverlay: Bool { captionsOn && phrases.isEmpty && voicesSettled }

    var nextEpisode: Episode? { book.episode(after: episode) }
    var previousEpisode: Episode? { book.episode(before: episode) }

    // MARK: Starting

    func start() async {
        guard let catalogSource else {
            voicesSettled = true
            return
        }
        let preferred = preferences.defaultVoiceID
        let fetch = Task { [loader, episode] in await loader.fetch(episodeID: episode.id, timeout: Self.loadTimeout) }

        if preferred == nil {
            begin(with: nil, catalogSource: catalogSource)
        } else if let early = await Self.value(of: fetch, within: Self.startWait) {
            received(early)
            begin(with: VoiceLogic.chooseVoice(voices, preferredID: preferred, hlsEnabled: hlsEnabled), catalogSource: catalogSource)
        } else {
            // The wait ran out: start on the catalog's source, and add the picker when the answer comes
            begin(with: nil, catalogSource: catalogSource)
        }
        voicesSettled = true
        if voices.isEmpty { received(await fetch.value) }
    }

    private func begin(with voice: EpisodeVoice?, catalogSource: StreamSource) {
        guard !begun else { return }
        begun = true
        if let voice, !voice.isDefault, let stream = StreamSource(voice: voice, hlsEnabled: hlsEnabled) {
            selectedVoiceID = voice.id
            let at = VoiceLogic.convertPosition(startSec, from: defaultTimeline, to: voice.timeline)
            engine.load(stream, at: at, durationSec: Double(voice.durationSec))
        } else {
            engine.load(catalogSource, at: startSec, durationSec: Double(episode.durationSec))
        }
    }

    private func received(_ list: [EpisodeVoice]?) {
        guard let list else { return }
        fetchedAt = .now
        voices = list
        positionChanged(engine.positionSec)
    }

    // MARK: Narrators

    /// The stream for a voice: its own, or the catalog's for the default voice.
    private func source(for voice: EpisodeVoice) -> StreamSource? {
        StreamSource(voice: voice, hlsEnabled: hlsEnabled) ?? (voice.isDefault ? catalogSource : nil)
    }

    /// The selected voice's timeline, ending where the player says the video ends.
    private var currentTimeline: Timeline {
        let duration = engine.durationSec
        if let selectedVoice {
            return Timeline(transcript: selectedVoice.transcript, durationSec: duration)
        }
        return Timeline(transcript: episode.transcript, durationSec: duration)
    }

    /// The default voice's timeline: the one saved progress and search matches use.
    private var defaultTimeline: Timeline {
        Timeline(transcript: episode.transcript, durationSec: Double(episode.durationSec))
    }

    /// A position on the voice being heard, moved to the default voice's timeline.
    private func defaultTimelineSec(_ sec: Double) -> Double {
        guard let selectedVoice, !selectedVoice.isDefault else { return sec }
        return VoiceLogic.convertPosition(sec, from: currentTimeline, to: defaultTimeline)
    }

    /// Switches narrator at the start of the sentence being spoken, and remembers the choice.
    func pickVoice(_ id: String) async {
        preferences.defaultVoiceID = id
        guard id != selectedVoice?.id else { return }
        // Don't start a new source from a signed URL that may have expired. If refreshing fails, try what's here.
        if let fetchedAt, ContinuousClock.now - fetchedAt > Self.staleAfter,
           let fresh = await loader.fetch(episodeID: episode.id, timeout: Self.refetchTimeout), !fresh.isEmpty {
            received(fresh)
        }
        guard let next = voices.first(where: { $0.id == id }), let stream = source(for: next) else { return }
        let from = currentTimeline
        let at = VoiceLogic.switchPosition(engine.positionSec, from: from, to: next.timeline, toCaptions: next.captions)
        selectedVoiceID = id
        engine.load(stream, at: at, durationSec: Double(next.durationSec))
        positionChanged(at)
    }

    // MARK: Playback events

    private func positionChanged(_ sec: Double) {
        let line = VoiceLogic.activeLineIndex(transcript, at: sec)
        if line != activeLineIndex { activeLineIndex = line }
        let caption = captionsOn ? VoiceLogic.activeCaption(phrases, at: sec) : nil
        if caption != activeCaption { activeCaption = caption }
        reportPosition(sec, saveNow: false)
    }

    /// Saves each whole second played, as the Expo player did: not 0 (nothing watched yet) and not the end (that's
    /// a completion). A seek saves at once, even back to the start.
    private func reportPosition(_ sec: Double, saveNow: Bool) {
        guard begun, !engine.hasEnded else { return }
        let whole = Int(defaultTimelineSec(sec).rounded(.down))
        guard whole < episode.durationSec, saveNow || (whole > 0 && whole != lastReportedSec) else { return }
        lastReportedSec = whole
        progress?.setPosition(episode.id, positionSec: whole, saveNow: saveNow)
    }

    /// Pausing (or stalling for good) sends the place now rather than at the next interval.
    private func playbackStateChanged() {
        refreshControls()
        if begun, !engine.isPlaying, !engine.isBuffering { progress?.saveNow() }
    }

    func setCaptions(_ on: Bool) {
        captionsOn = on
        positionChanged(engine.positionSec)
    }

    func seek(to sec: Double) {
        engine.seek(to: sec)
        positionChanged(engine.positionSec)
        reportPosition(engine.positionSec, saveNow: true)
    }

    private func episodeEnded() {
        progress?.markCompleted(episode.id)
        guard let next = nextEpisode else { return }
        if next.locked {
            onLockedNext?(next)
        } else if preferences.autoplayNext {
            onAdvance?(next)
        }
    }

    /// A source failed with no fallback left, most likely an expired signed URL: try once a minute with fresh URLs.
    private func sourceFailed() {
        if let lastRecovery, ContinuousClock.now - lastRecovery < .seconds(60) { return }
        lastRecovery = .now
        Task {
            let fresh = await loader.fetch(episodeID: episode.id, timeout: Self.refetchTimeout)
            guard let fresh, !fresh.isEmpty else { return }
            received(fresh)
            if let voice = selectedVoice, let stream = source(for: voice) {
                engine.load(stream, at: engine.positionSec, durationSec: Double(voice.durationSec))
            }
        }
    }

    /// Leaving the episode: stops playback, and sends the place and reloads progress for the screens underneath.
    func stop() {
        hideTask?.cancel()
        engine.stop()
        if let progress {
            Task { await progress.sync() }
        }
    }

    // MARK: Controls

    /// Whether the controls may fade by themselves. A screen reader needs them to stay in place.
    private var canAutoHide: Bool { engine.isPlaying && !isScrubbing && !isVoiceOverRunning }

    /// A touch on the video: show the controls, or hide them if they're showing.
    func toggleControls() {
        if controlsVisible && canAutoHide {
            hideTask?.cancel()
            controlsVisible = false
        } else {
            showControls()
        }
    }

    /// Any interaction with the controls keeps them up a while longer.
    func showControls() {
        controlsVisible = true
        scheduleHide()
    }

    private func refreshControls() {
        if canAutoHide {
            scheduleHide()
        } else if !engine.isPlaying && !engine.isBuffering {
            // Stopped for a reason the viewer can act on (paused, ended, failed), after a beat so a resume's
            // momentary "not playing" doesn't flash them
            hideTask?.cancel()
            hideTask = Task {
                try? await Task.sleep(for: Self.pauseRevealDelay)
                guard !Task.isCancelled, !engine.isPlaying, !engine.isBuffering else { return }
                controlsVisible = true
            }
        } else {
            hideTask?.cancel()
            if isScrubbing || isVoiceOverRunning { controlsVisible = true }
        }
    }

    private func scheduleHide() {
        hideTask?.cancel()
        guard canAutoHide else { return }
        hideTask = Task {
            try? await Task.sleep(for: Self.controlsAutoHide)
            guard !Task.isCancelled, canAutoHide else { return }
            controlsVisible = false
        }
    }

    // MARK: Helpers

    /// The task's value if it finishes within `limit`, else nil. The task keeps running either way.
    private static func value<T: Sendable>(of task: Task<T, Never>, within limit: Duration) async -> T? {
        let race = FirstResult<T?>()
        return await withCheckedContinuation { continuation in
            race.continuation = continuation
            Task { race.finish(await task.value) }
            Task {
                try? await Task.sleep(for: limit)
                race.finish(nil)
            }
        }
    }
}
