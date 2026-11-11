import Foundation

/// The API calls behind Premium, so tests can fake them and the contract lives in one adapter (`GraphQLPremiumAPI`).
protocol PremiumAPI: AnyObject, Sendable {
    /// `me.premium`; `.none` when signed out.
    func premium() async throws(APIError) -> Premium
    /// `me.appAccountToken`: the UUID that ties App Store purchases to the account.
    func appAccountToken() async throws(APIError) -> UUID
    /// Hands the API a transaction signed by the App Store; it answers with the account's Premium.
    func syncAppStoreTransaction(_ signedTransaction: String) async throws(APIError) -> Premium
    /// Has the API look at the subscription again.
    func refreshPremium() async throws(APIError) -> Premium
}
