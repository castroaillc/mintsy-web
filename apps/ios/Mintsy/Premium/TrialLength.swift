import Foundation

/// How long a free trial lasts, for "Start 7-day free trial" and "Free for 7 days".
nonisolated struct TrialLength: Equatable, Sendable {
    let count: Int
    let unit: PeriodUnit

    /// "7 days", "1 month".
    var noun: String { "\(count) \(unit.rawValue)\(count == 1 ? "" : "s")" }

    /// "7-day", "1-month".
    var adjective: String { "\(count)-\(unit.rawValue)" }
}

nonisolated extension TrialLength {
    /// The length of a free introductory offer. A paid introductory price isn't a trial.
    init?(_ intro: IntroOffer?) {
        guard let intro, intro.isFree else { return nil }
        let count = intro.value * max(1, intro.cycles)
        guard count > 0 else { return nil }
        self.init(count: count, unit: intro.unit)
    }
}
