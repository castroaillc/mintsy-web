import Foundation

/// A voice's line starts and length: what lets a position on one narrator's video be found on another's.
nonisolated struct Timeline: Equatable, Sendable {
    var lineStarts: [Double]
    var durationSec: Double

    init(lineStarts: [Double], durationSec: Double) {
        self.lineStarts = lineStarts
        self.durationSec = durationSec
    }

    init(transcript: [TranscriptLine], durationSec: Double) {
        self.init(lineStarts: transcript.map { Double($0.startSec) }, durationSec: durationSec)
    }

    /// Line starts are whole seconds, so neighbours can be equal, but they must not run backwards.
    var isUsable: Bool {
        lineStarts.enumerated().allSatisfy { index, start in
            start.isFinite && start >= 0 && (index == 0 || start >= lineStarts[index - 1])
        }
    }

    /// Whether two timelines can be matched line by line.
    func linesMatch(_ other: Timeline) -> Bool {
        !lineStarts.isEmpty && lineStarts.count == other.lineStarts.count && isUsable && other.isUsable
    }
}
