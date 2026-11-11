#if DEBUG
import Foundation

/// A pretend API for previews and screenshots, next to `DemoPurchases`: it accepts the sample purchase as a
/// one-week trial. The real API never hears of it, so nothing is unlocked.
final class DemoPremiumAPI: PremiumAPI {
    private var state = Premium.none

    func premium() async throws(APIError) -> Premium { state }

    func appAccountToken() async throws(APIError) -> UUID { UUID() }

    func syncAppStoreTransaction(_ signedTransaction: String) async throws(APIError) -> Premium {
        let ends = Date.now.addingTimeInterval(7 * 24 * 3600).formatted(.iso8601)
        state = Premium(active: true, expiresAt: ends, willRenew: true, periodType: "trial", productId: signedTransaction, store: "app_store")
        return state
    }

    func refreshPremium() async throws(APIError) -> Premium { state }
}

extension PremiumStore {
    static var preview: PremiumStore {
        PremiumStore(api: DemoPremiumAPI(), purchases: DemoPurchases()) {}
    }
}
#endif
