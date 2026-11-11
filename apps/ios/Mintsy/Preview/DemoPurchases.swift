#if DEBUG
import Foundation

/// Sample plans for SwiftUI previews, screenshots and UI tests (`-MintsyDemoPurchases YES` on a Development build).
/// The prices are made up and nothing is bought.
final class DemoPurchases: PurchasesClient {
    let transactionUpdates = AsyncStream<StoreTransaction> { $0.finish() }

    func packages() async throws(PurchasesError) -> [StorePackage] {
        let trial = IntroOffer(isFree: true, unit: .week, value: 1, cycles: 1)
        return [
            StorePackage(
                kind: .yearly, productID: PlanKind.yearly.productID, price: 59.99, priceString: "$59.99",
                perMonthString: "$5.00", intro: trial, isIntroEligible: true
            ),
            StorePackage(
                kind: .monthly, productID: PlanKind.monthly.productID, price: 9.99, priceString: "$9.99",
                perMonthString: nil, intro: trial, isIntroEligible: true
            ),
        ]
    }

    func purchase(_ kind: PlanKind, appAccountToken: UUID) async throws(PurchasesError) -> StorePurchase {
        .purchased(StoreTransaction(id: 1, productID: kind.productID, signedTransaction: kind.productID, appAccountToken: appAccountToken))
    }

    func currentEntitlements() async -> [StoreTransaction] { [] }
    func sync() async throws(PurchasesError) {}
    func finish(_ transaction: StoreTransaction) async {}
}
#endif
