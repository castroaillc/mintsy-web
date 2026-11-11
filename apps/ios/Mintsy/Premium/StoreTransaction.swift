import Foundation

/// A verified App Store transaction for one of the plans, as the API needs it.
nonisolated struct StoreTransaction: Equatable, Sendable, Identifiable {
    let id: UInt64
    let productID: String
    /// The transaction signed by the App Store (JWS), which the API verifies for itself.
    let signedTransaction: String
    /// The mintsy account the purchase was made for; nil when it was bought outside the app.
    let appAccountToken: UUID?
}
