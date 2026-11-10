import AVFoundation
import Observation

/// AVPlayer driven the way the Expo app's `useVideoClock` drives expo-video: one source at a time, a fallback tried
/// once when a source fails (HLS → MP4), the resume position applied once the item is ready, and a speed that
/// carries across sources.
@Observable
final class PlaybackEngine {
    /// Speeds the speed button cycles through.
    static let speeds: [Float] = [1, 1.25, 1.5, 2]

    @ObservationIgnored let player = AVPlayer()

    /// Seconds into the current source. Updated four times a second while playing.
    private(set) var positionSec: Double = 0
    /// The source's real length once it's loaded; until then the API's (rounded) duration.
    private(set) var durationSec: Double
    private(set) var isPlaying = false
    /// Waiting for data while it should be playing.
    private(set) var isBuffering = false
    private(set) var hasEnded = false
    /// The source failed and had no fallback left.
    private(set) var hasFailed = false
    private(set) var speed: Float = 1

    /// Called on each position update (seconds).
    @ObservationIgnored var onTick: ((Double) -> Void)?
    /// Called when playing or buffering changes.
    @ObservationIgnored var onStateChange: (() -> Void)?
    @ObservationIgnored var onEnd: (() -> Void)?
    @ObservationIgnored var onFailure: (() -> Void)?

    @ObservationIgnored private var fallback: URL?
    /// Where the next source to become ready starts.
    @ObservationIgnored private var pendingSeek: Double = 0
    @ObservationIgnored private var wantsPlay = true
    /// Bumped by each load, so callbacks from a replaced item are ignored.
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private var started = false
    @ObservationIgnored private var timeObserver: Any?
    @ObservationIgnored private var timeControlObservation: NSKeyValueObservation?
    @ObservationIgnored private var itemObservation: NSKeyValueObservation?
    @ObservationIgnored private var endObserver: (any NSObjectProtocol)?

    init(durationSec: Double) {
        self.durationSec = durationSec
        player.automaticallyWaitsToMinimizeStalling = true
        timeControlObservation = player.observe(\.timeControlStatus, options: [.initial, .new]) { @Sendable [weak self] player, _ in
            let status = player.timeControlStatus
            Task { @MainActor [weak self] in self?.apply(status) }
        }
        let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
        // The main queue, so the callback is already on the main actor
        timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { @Sendable [weak self] time in
            MainActor.assumeIsolated { self?.tick(time) }
        }
    }

    /// Replaces the source. `position` is on that source's timeline.
    func load(_ source: StreamSource, at position: Double = 0, durationSec: Double) {
        generation += 1
        started = false
        hasEnded = false
        hasFailed = false
        fallback = source.fallback
        pendingSeek = max(0, position)
        positionSec = pendingSeek
        self.durationSec = durationSec
        player.pause()
        replaceItem(with: source.url)
    }

    func play() {
        wantsPlay = true
        if hasEnded {
            hasEnded = false
            seek(to: 0)
        }
        player.playImmediately(atRate: speed)
    }

    func pause() {
        wantsPlay = false
        player.pause()
    }

    func togglePlay() {
        isPlaying ? pause() : play()
    }

    func seek(to seconds: Double) {
        let target = min(max(0, seconds), durationSec)
        positionSec = target
        hasEnded = false
        guard started else {
            pendingSeek = target
            return
        }
        player.seek(to: CMTime(seconds: target, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
    }

    func skip(by seconds: Double) {
        seek(to: positionSec + seconds)
    }

    func cycleSpeed() {
        let index = Self.speeds.firstIndex(of: speed) ?? 0
        speed = Self.speeds[(index + 1) % Self.speeds.count]
        player.defaultRate = speed
        if isPlaying { player.rate = speed }
    }

    /// Stops playback and drops the item (leaving the player).
    func stop() {
        generation += 1
        player.pause()
        player.replaceCurrentItem(with: nil)
        itemObservation = nil
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        endObserver = nil
        if let timeObserver { player.removeTimeObserver(timeObserver) }
        timeObserver = nil
        timeControlObservation = nil
    }

    // MARK: Private

    private func replaceItem(with url: URL) {
        let item = AVPlayerItem(url: url)
        let current = generation
        itemObservation = item.observe(\.status, options: [.initial, .new]) { @Sendable [weak self] item, _ in
            let status = item.status
            Task { @MainActor [weak self] in self?.itemStatusChanged(status, generation: current) }
        }
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        endObserver = NotificationCenter.default.addObserver(
            forName: AVPlayerItem.didPlayToEndTimeNotification, object: item, queue: .main
        ) { @Sendable [weak self] _ in
            MainActor.assumeIsolated { self?.ended(generation: current) }
        }
        player.replaceCurrentItem(with: item)
    }

    private func itemStatusChanged(_ status: AVPlayerItem.Status, generation: Int) {
        guard generation == self.generation else { return }
        switch status {
        case .readyToPlay:
            guard !started else { return }
            started = true
            if let duration = player.currentItem?.duration.seconds, duration.isFinite, duration > 0 {
                durationSec = duration
            }
            player.defaultRate = speed
            if pendingSeek > 0 {
                player.seek(to: CMTime(seconds: pendingSeek, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
            }
            if wantsPlay { player.playImmediately(atRate: speed) }
        case .failed:
            if let fallback {
                self.fallback = nil
                let at = positionSec
                self.generation += 1
                started = false
                pendingSeek = at
                replaceItem(with: fallback)
            } else {
                hasFailed = true
                onFailure?()
            }
        default:
            break
        }
    }

    private func apply(_ status: AVPlayer.TimeControlStatus) {
        let playing = status == .playing
        let buffering = status == .waitingToPlayAtSpecifiedRate
        guard playing != isPlaying || buffering != isBuffering else { return }
        isPlaying = playing
        isBuffering = buffering
        onStateChange?()
    }

    private func tick(_ time: CMTime) {
        guard started, !hasEnded else { return }
        let seconds = time.seconds
        guard seconds.isFinite else { return }
        positionSec = seconds
        onTick?(seconds)
    }

    private func ended(generation: Int) {
        guard generation == self.generation else { return }
        hasEnded = true
        positionSec = durationSec
        onTick?(durationSec)
        onEnd?()
    }
}
