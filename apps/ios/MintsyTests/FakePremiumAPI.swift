import Foundation
@testable import Mintsy

/// The API's Premium calls, scripted.
final class FakePremiumAPI: PremiumAPI {
    static let active = Premium(
        active: true, expiresAt: "2027-01-01T00:00:00.000Z", willRenew: true, periodType: "trial",
        productId: "mintsy_premium_yearly", store: "app_store"
    )

    var state = Premium.none
    /// Nil: the API can't give the token (an older API, or offline).
    var token: UUID? = UUID()
    /// What the API answers to a transaction; nil refuses it.
    var stateAfterSync: Premium? = FakePremiumAPI.active
    /// The first this many transactions are refused, then `stateAfterSync` applies.
    var refusals = 0

    private(set) var synced: [String] = []
    private(set) var refreshCount = 0

    func premium() async throws(APIError) -> Premium { state }

    func appAccountToken() async throws(APIError) -> UUID {
        guard let token else { throw .http(statusCode: 400) }
        return token
    }

    func syncAppStoreTransaction(_ signedTransaction: String) async throws(APIError) -> Premium {
        synced.append(signedTransaction)
        if refusals > 0 {
            refusals -= 1
            throw .network(.notConnectedToInternet)
        }
        guard let stateAfterSync else { throw .http(statusCode: 500) }
        state = stateAfterSync
        return state
    }

    func refreshPremium() async throws(APIError) -> Premium {
        refreshCount += 1
        return state
    }
}
