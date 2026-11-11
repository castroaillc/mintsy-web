import Foundation

/// The unit of a subscription or trial period, as the store reports it.
nonisolated enum PeriodUnit: String, Sendable {
    case day, week, month, year
}
