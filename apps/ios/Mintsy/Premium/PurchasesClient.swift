import Foundation

/// The App Store as the app uses it, so tests can fake it. `StoreKitPurchases` is the real one.
protocol PurchasesClient: AnyObject, Sendable {
    /// Verified transactions the App Store delivers by itself, from launch: renewals, approved Ask to Buy
    /// purchases, purchases made elsewhere, and any left unfinished.
    var transactionUpdates: AsyncStream<StoreTransaction> { get }

    /// The yearly and monthly products, whichever the App Store has, with its prices and introductory offer.
    func packages() async throws(PurchasesError) -> [StorePackage]
    /// Buys a plan from the last `packages()` answer for the account the token stands for.
    func purchase(_ kind: PlanKind, appAccountToken: UUID) async throws(PurchasesError) -> StorePurchase
    /// The Apple Account's active subscriptions to the plans.
    func currentEntitlements() async -> [StoreTransaction]
    /// Has the App Store resend the Apple Account's transactions (Restore purchases). May ask the viewer to sign in.
    func sync() async throws(PurchasesError)
    /// Tells the App Store the purchase was delivered. Only after the API accepted it.
    func finish(_ transaction: StoreTransaction) async
}
