import Foundation

/// Why a purchase, restore or request for the plans failed.
nonisolated enum PurchasesError: Error, Equatable, Sendable {
    /// Purchases aren't allowed on this device (Screen Time restrictions).
    case unavailable
    /// The API didn't give the account's App Store token, so a purchase couldn't be tied to the account.
    case accountUnavailable
    /// The App Store has neither the yearly nor the monthly product.
    case noPlans
    /// The purchase is waiting for someone's approval (Ask to Buy) or for the bank.
    case pending
    /// The viewer backed out of the App Store's sign-in while restoring.
    case cancelled
    /// The App Store took the purchase, but the API hasn't accepted it yet. It stays unfinished and is sent again.
    case notActivated
    /// Anything else, with StoreKit's description for the log.
    case store(String)
}
