import Foundation

/// Minutes a day the viewer wants to watch (design 8). The raw value is the minutes; 0 is no daily goal.
nonisolated enum DailyGoal: Int, CaseIterable, Codable, Sendable, Identifiable {
    case quick = 5
    case steady = 15
    case deepDive = 30
    case flexible = 0

    var id: Self { self }

    var minutes: Int { rawValue }

    var title: String {
        switch self {
        case .quick: "Quick"
        case .steady: "Steady"
        case .deepDive: "Deep dive"
        case .flexible: "I’ll decide as I go"
        }
    }

    /// The caption when the catalog can't say how many episodes that is.
    var fallbackCaption: String {
        self == .flexible ? "No daily goal" : "\(minutes) minutes a day"
    }

    /// For a segmented control: "15 min", "Flexible".
    var shortLabel: String {
        self == .flexible ? "Flexible" : "\(minutes) min"
    }
}
