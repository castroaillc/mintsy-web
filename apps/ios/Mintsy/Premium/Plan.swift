import Foundation

/// One plan on the paywall.
nonisolated struct Plan: Equatable, Sendable, Identifiable {
    let kind: PlanKind
    let productID: String
    /// Localized price from the store.
    let priceString: String
    /// Yearly only: the store's localized per-month equivalent.
    let perMonthString: String?
    /// The free trial this customer can take, if any.
    let trial: TrialLength?

    var id: PlanKind { kind }

    /// "$59.99/year"
    var pricePerPeriod: String { "\(priceString)/\(kind.periodNoun)" }

    /// The line under the plan's name.
    var billingNote: String {
        switch kind {
        case .yearly:
            perMonthString.map { "Just \($0)/month, billed yearly" } ?? "Billed every year"
        case .monthly:
            "Billed every month"
        }
    }
}
