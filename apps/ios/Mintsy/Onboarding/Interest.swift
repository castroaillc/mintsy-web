import Foundation

/// A topic the viewer can pick in onboarding (design 7). The raw value is both the label and what's stored.
nonisolated enum Interest: String, CaseIterable, Codable, Sendable, Identifiable {
    case finance = "Finance"
    case investing = "Investing"
    case business = "Business"
    case leadership = "Leadership"
    case psychology = "Psychology"
    case productivity = "Productivity"
    case health = "Health"
    case science = "Science"
    case history = "History"
    case philosophy = "Philosophy"
    case relationships = "Relationships"
    case creativity = "Creativity"
    case marketing = "Marketing"
    case startups = "Startups"

    /// How many the interests step asks for before Continue.
    static let minimum = 3

    var id: Self { self }

    /// The catalog category this interest draws recommendations from (the Expo app's `INTEREST_CATEGORY`).
    var category: String {
        switch self {
        case .finance, .investing: "Finance"
        case .business, .leadership, .marketing, .startups: "Business"
        case .psychology, .relationships, .philosophy: "Psychology"
        case .productivity, .creativity: "Productivity"
        case .health, .science: "Health"
        case .history: "History"
        }
    }
}
