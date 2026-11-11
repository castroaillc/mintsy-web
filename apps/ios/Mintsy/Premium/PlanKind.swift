import Foundation

/// The two subscriptions the paywall sells, in one App Store subscription group.
nonisolated enum PlanKind: String, Sendable, CaseIterable {
    case yearly, monthly

    var name: String {
        switch self {
        case .yearly: "Yearly"
        case .monthly: "Monthly"
        }
    }

    /// For "then <price>/year".
    var periodNoun: String {
        switch self {
        case .yearly: "year"
        case .monthly: "month"
        }
    }

    /// The App Store product (`apps/docs/contracts.md`, Premium).
    var productID: String {
        switch self {
        case .yearly: "mintsy_premium_yearly"
        case .monthly: "mintsy_premium_monthly"
        }
    }

    /// The plan a store product id is for.
    init?(productID: String?) {
        guard let kind = Self.allCases.first(where: { $0.productID == productID }) else { return nil }
        self = kind
    }
}
