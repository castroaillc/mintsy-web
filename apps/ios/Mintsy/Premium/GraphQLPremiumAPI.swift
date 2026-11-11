import Foundation

/// Premium over GraphQL. `appAccountToken` and `syncAppStoreTransaction` follow the shape proposed for the StoreKit
/// contract; this is the one place to adjust when the backend settles it.
final class GraphQLPremiumAPI: PremiumAPI {
    private let client: GraphQLClient

    init(client: GraphQLClient) {
        self.client = client
    }

    private nonisolated struct PremiumHolder: Decodable, Sendable {
        let premium: Premium
    }

    private nonisolated struct TokenHolder: Decodable, Sendable {
        let appAccountToken: String
    }

    private nonisolated struct MeData<Me: Decodable & Sendable>: Decodable, Sendable {
        let me: Me?
    }

    private nonisolated struct SyncData: Decodable, Sendable {
        let syncAppStoreTransaction: Premium
    }

    private nonisolated struct RefreshData: Decodable, Sendable {
        let refreshPremium: Premium
    }

    func premium() async throws(APIError) -> Premium {
        try await client.send(PremiumQueries.premium, as: MeData<PremiumHolder>.self).me?.premium ?? .none
    }

    func appAccountToken() async throws(APIError) -> UUID {
        let data = try await client.send(PremiumQueries.appAccountToken, as: MeData<TokenHolder>.self)
        guard let token = data.me.flatMap({ UUID(uuidString: $0.appAccountToken) }) else {
            throw .decoding("me.appAccountToken isn't a UUID")
        }
        return token
    }

    func syncAppStoreTransaction(_ signedTransaction: String) async throws(APIError) -> Premium {
        try await client.send(
            PremiumQueries.syncAppStoreTransaction,
            variables: ["signedTransaction": .string(signedTransaction)],
            as: SyncData.self
        ).syncAppStoreTransaction
    }

    func refreshPremium() async throws(APIError) -> Premium {
        try await client.send(PremiumQueries.refresh, as: RefreshData.self).refreshPremium
    }
}
