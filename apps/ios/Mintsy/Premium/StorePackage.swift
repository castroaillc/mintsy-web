import Foundation

/// A plan's product as the App Store describes it: every price here comes from the store.
nonisolated struct StorePackage: Equatable, Sendable {
    let kind: PlanKind
    /// The App Store product, e.g. `mintsy_premium_yearly`.
    let productID: String
    let price: Decimal
    /// Localized by the store, e.g. "$59.99".
    let priceString: String
    /// The price divided over the months of the period, localized by the store.
    let perMonthString: String?
    let intro: IntroOffer?
    /// The App Store says this Apple Account can still take the introductory offer.
    let isIntroEligible: Bool
}
