import Foundation

/// The API's view of the viewer's subscription (`me.premium`, `refreshPremium`): what decides `Episode.locked`.
nonisolated struct Premium: Decodable, Equatable, Sendable {
    let active: Bool
    /// ISO 8601: the end of the current period or trial. Nil if never subscribed, or it never expires.
    let expiresAt: String?
    let willRenew: Bool
    /// Lowercased: trial, normal or intro.
    let periodType: String?
    let productId: String?
    /// Where it was bought, lowercased: app_store, play_store, rc_billing or stripe (the web), promotional, …
    let store: String?

    /// Never subscribed.
    static let none = Premium(active: false, expiresAt: nil, willRenew: false, periodType: nil, productId: nil, store: nil)

    var expiryDate: Date? { expiresAt.flatMap(ISODate.parse) }
    var planKind: PlanKind? { PlanKind(productID: productId) }

    /// Bought on the web: managed there, never from the app.
    var isWebStore: Bool { store == "rc_billing" || store == "stripe" }
    var isAppStore: Bool { store == "app_store" || store == "mac_app_store" }

    /// Who bills it, for "Billed through".
    var storeName: String? {
        switch store {
        case "app_store", "mac_app_store": "App Store"
        case "play_store": "Google Play"
        case "rc_billing", "stripe": "Web"
        default: nil
        }
    }

    /// Where the subscription stands, for Plan details. Nil when there's no active Premium.
    var status: PlanStatus? {
        guard active else { return nil }
        guard let date = expiryDate else { return .active(renews: nil) }
        if !willRenew { return .ending(date) }
        return periodType == "trial" ? .trial(ends: date) : .active(renews: date)
    }
}
