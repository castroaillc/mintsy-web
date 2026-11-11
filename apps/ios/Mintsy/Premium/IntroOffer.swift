import Foundation

/// A product's introductory offer, as the store describes it.
nonisolated struct IntroOffer: Equatable, Sendable {
    /// A free trial; false for a discounted introductory price.
    let isFree: Bool
    let unit: PeriodUnit
    /// Units per period (7 for "7 days").
    let value: Int
    /// How many periods the offer lasts.
    let cycles: Int
}
