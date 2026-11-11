import Foundation

/// The GraphQL documents for the viewer's Premium state (`apps/backend/src/graphql/schema.ts`).
nonisolated enum PremiumQueries {
    static let fields = "active expiresAt willRenew periodType productId store"

    static let premium = "query MePremium { me { premium { \(fields) } } }"

    /// Asked for by itself, so an API without the field still answers `me.premium`.
    static let appAccountToken = "query MeAppAccountToken { me { appAccountToken } }"

    static let syncAppStoreTransaction = """
        mutation SyncAppStoreTransaction($signedTransaction: String!) {
          syncAppStoreTransaction(signedTransaction: $signedTransaction) { \(fields) }
        }
        """

    static let refresh = "mutation RefreshPremium { refreshPremium { \(fields) } }"
}
