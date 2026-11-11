import Foundation

/// Where an active subscription stands.
nonisolated enum PlanStatus: Equatable, Sendable {
    /// In a free trial that turns into a paid period on this date.
    case trial(ends: Date)
    /// Paid and renewing on this date; nil for access with no end date.
    case active(renews: Date?)
    /// Cancelled (or billing failed): access lasts until this date.
    case ending(Date)

    /// The badge on Plan details.
    var badge: String {
        switch self {
        case .trial: "Free trial"
        case .active: "Active"
        case .ending: "Ends soon"
        }
    }
}
