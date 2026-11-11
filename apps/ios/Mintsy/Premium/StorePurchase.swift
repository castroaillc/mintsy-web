import Foundation

/// How the App Store's purchase sheet ended.
nonisolated enum StorePurchase: Equatable, Sendable {
    case purchased(StoreTransaction)
    /// The viewer backed out. Not an error: nothing is shown.
    case cancelled
    /// Waiting for someone's approval (Ask to Buy) or for the bank; the transaction arrives later as an update.
    case pending
}
