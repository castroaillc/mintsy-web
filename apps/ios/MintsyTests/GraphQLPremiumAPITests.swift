import Foundation
import Testing
@testable import Mintsy

/// The Premium calls as they go to the API.
struct GraphQLPremiumAPITests {
    private func api(host: String) -> GraphQLPremiumAPI {
        GraphQLPremiumAPI(client: GraphQLClient(endpoint: URL(string: "https://\(host)/graphql")!, session: StubURLProtocol.session()) { "better-auth.session_token=t" })
    }

    private func body(_ seen: StubURLProtocol.Seen) -> (query: String, variables: [String: Any]) {
        let object = (seen.body.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]) ?? [:]
        return (object["query"] as? String ?? "", object["variables"] as? [String: Any] ?? [:])
    }

    private nonisolated static let premiumJSON = #"{"active":true,"expiresAt":"2027-01-01T00:00:00.000Z","willRenew":true,"periodType":"trial","productId":"mintsy_premium_yearly","store":"app_store"}"#

    @Test func readsPremiumAndTreatsSignedOutAsNone() async throws {
        let host = "premium-me.test"
        StubURLProtocol.register(host: host) { _ in .init(body: Data(#"{"data":{"me":{"premium":\#(Self.premiumJSON)}}}"#.utf8)) }
        let premium = try await api(host: host).premium()
        #expect(premium.active && premium.periodType == "trial" && premium.store == "app_store")
        let sent = try #require(StubURLProtocol.requests(for: host).first.map(body))
        #expect(sent.query == "query MePremium { me { premium { active expiresAt willRenew periodType productId store } } }")

        let signedOut = "premium-signed-out.test"
        StubURLProtocol.register(host: signedOut) { _ in .init(body: Data(#"{"data":{"me":null}}"#.utf8)) }
        #expect(try await api(host: signedOut).premium() == .none)
    }

    @Test func readsTheAppAccountTokenByItself() async throws {
        let host = "premium-token.test"
        StubURLProtocol.register(host: host) { _ in
            .init(body: Data(#"{"data":{"me":{"appAccountToken":"0B5F6A52-1C0F-4C52-9E8B-2B1A3C4D5E6F"}}}"#.utf8))
        }
        let token = try await api(host: host).appAccountToken()
        #expect(token == UUID(uuidString: "0B5F6A52-1C0F-4C52-9E8B-2B1A3C4D5E6F"))
        let sent = try #require(StubURLProtocol.requests(for: host).first.map(body))
        #expect(sent.query == "query MeAppAccountToken { me { appAccountToken } }")
    }

    @Test func anAPIWithoutTheTokenIsAnError() async {
        let host = "premium-no-token.test"
        StubURLProtocol.register(host: host) { _ in
            .init(status: 400, body: Data(#"{"errors":[{"message":"Cannot query field \"appAccountToken\" on type \"User\".","extensions":{"code":"GRAPHQL_VALIDATION_FAILED"}}]}"#.utf8))
        }
        await #expect(throws: APIError.self) { try await api(host: host).appAccountToken() }

        let malformed = "premium-bad-token.test"
        StubURLProtocol.register(host: malformed) { _ in .init(body: Data(#"{"data":{"me":{"appAccountToken":"nope"}}}"#.utf8)) }
        await #expect(throws: APIError.self) { try await api(host: malformed).appAccountToken() }
    }

    @Test func sendsTheSignedTransaction() async throws {
        let host = "premium-sync.test"
        StubURLProtocol.register(host: host) { _ in .init(body: Data(#"{"data":{"syncAppStoreTransaction":\#(Self.premiumJSON)}}"#.utf8)) }
        let premium = try await api(host: host).syncAppStoreTransaction("eyJ.signed.jws")
        #expect(premium.active)
        let sent = try #require(StubURLProtocol.requests(for: host).first.map(body))
        #expect(sent.query.contains("mutation SyncAppStoreTransaction($signedTransaction: String!)"))
        #expect(sent.query.contains("syncAppStoreTransaction(signedTransaction: $signedTransaction) { active expiresAt willRenew periodType productId store }"))
        #expect(sent.variables["signedTransaction"] as? String == "eyJ.signed.jws")
    }

    @Test func refreshesPremium() async throws {
        let host = "premium-refresh.test"
        StubURLProtocol.register(host: host) { _ in .init(body: Data(#"{"data":{"refreshPremium":\#(Self.premiumJSON)}}"#.utf8)) }
        #expect(try await api(host: host).refreshPremium().active)
        let sent = try #require(StubURLProtocol.requests(for: host).first.map(body))
        #expect(sent.query == "mutation RefreshPremium { refreshPremium { active expiresAt willRenew periodType productId store } }")
    }
}
