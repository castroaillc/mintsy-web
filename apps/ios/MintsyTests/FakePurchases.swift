import Foundation
@testable import Mintsy

/// The App Store, scripted.
final class FakePurchases: PurchasesClient {
    let transactionUpdates: AsyncStream<StoreTransaction>
    /// Delivers a transaction as `Transaction.updates` would.
    let updates: AsyncStream<StoreTransaction>.Continuation

    var storePackages = [
        StorePackage(
            kind: .yearly, productID: "mintsy_premium_yearly", price: 60, priceString: "$60.00", perMonthString: "$5.00",
            intro: IntroOffer(isFree: true, unit: .week, value: 1, cycles: 1), isIntroEligible: true
        ),
        StorePackage(
            kind: .monthly, productID: "mintsy_premium_monthly", price: 10, priceString: "$10.00", perMonthString: nil,
            intro: nil, isIntroEligible: false
        ),
    ]
    var packagesError: PurchasesError?
    /// What the purchase sheet does; nil buys the plan.
    var purchaseResult: Result<StorePurchase, PurchasesError>?
    var entitlements: [StoreTransaction] = []
    /// What `currentEntitlements` holds once `sync()` has run.
    var entitlementsAfterSync: [StoreTransaction]?
    var syncError: PurchasesError?

    private(set) var purchases: [(kind: PlanKind, token: UUID)] = []
    private(set) var finished: [UInt64] = []
    private(set) var syncCount = 0

    init() {
        (transactionUpdates, updates) = AsyncStream.makeStream()
    }

    static func transaction(_ id: UInt64, _ kind: PlanKind = .yearly, token: UUID?) -> StoreTransaction {
        StoreTransaction(id: id, productID: kind.productID, signedTransaction: "jws-\(id)", appAccountToken: token)
    }

    func packages() async throws(PurchasesError) -> [StorePackage] {
        if let packagesError { throw packagesError }
        return storePackages
    }

    func purchase(_ kind: PlanKind, appAccountToken: UUID) async throws(PurchasesError) -> StorePurchase {
        purchases.append((kind, appAccountToken))
        switch purchaseResult {
        case .success(let purchase): return purchase
        case .failure(let error): throw error
        case nil: return .purchased(Self.transaction(100, kind, token: appAccountToken))
        }
    }

    func currentEntitlements() async -> [StoreTransaction] { entitlements }

    func sync() async throws(PurchasesError) {
        syncCount += 1
        if let syncError { throw syncError }
        if let entitlementsAfterSync { entitlements = entitlementsAfterSync }
    }

    func finish(_ transaction: StoreTransaction) async {
        finished.append(transaction.id)
    }
}
