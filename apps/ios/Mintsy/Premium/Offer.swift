import Foundation

/// What the paywall shows, worked out from the App Store's products.
nonisolated struct Offer: Equatable, Sendable {
    let yearly: Plan?
    let monthly: Plan?
    /// Whole percent saved by paying yearly instead of twelve monthly payments; nil when unknown or not a saving.
    let savingsPercent: Int?

    func plan(_ kind: PlanKind) -> Plan? {
        switch kind {
        case .yearly: yearly
        case .monthly: monthly
        }
    }

    /// The plans in the order the paywall lists them.
    var plans: [Plan] { [yearly, monthly].compactMap(\.self) }

    /// Throws `.noPlans` when the store has neither product.
    static func make(from packages: [StorePackage]) throws(PurchasesError) -> Offer {
        let yearly = packages.first { $0.kind == .yearly }
        let monthly = packages.first { $0.kind == .monthly }
        guard yearly != nil || monthly != nil else { throw .noPlans }
        var savings: Int?
        if let yearly, let monthly {
            savings = savingsPercent(yearly: yearly.price, monthly: monthly.price)
        }
        return Offer(yearly: yearly.map(plan), monthly: monthly.map(plan), savingsPercent: savings)
    }

    /// Whole percent saved by the yearly price against twelve monthly payments.
    static func savingsPercent(yearly: Decimal, monthly: Decimal) -> Int? {
        guard yearly > 0, monthly > 0 else { return nil }
        let fraction = 1 - yearly / (monthly * 12)
        let percent = Int((NSDecimalNumber(decimal: fraction * 100).doubleValue).rounded())
        return percent > 0 ? percent : nil
    }

    private static func plan(_ package: StorePackage) -> Plan {
        Plan(
            kind: package.kind,
            productID: package.productID,
            priceString: package.priceString,
            perMonthString: package.kind == .yearly ? package.perMonthString : nil,
            trial: package.isIntroEligible ? TrialLength(package.intro) : nil
        )
    }
}
