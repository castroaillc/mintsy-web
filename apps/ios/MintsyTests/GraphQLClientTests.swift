import Foundation
import Testing
@testable import Mintsy

struct GraphQLClientTests {
    private nonisolated struct Hello: Decodable, Sendable { let hello: String }

    private func client(host: String, cookie: String? = nil) -> GraphQLClient {
        GraphQLClient(endpoint: URL(string: "https://\(host)/graphql")!, session: StubURLProtocol.session()) { cookie }
    }

    @Test func sendsTheQueryVariablesAndSessionCookie() async throws {
        let host = "gql-ok.test"
        StubURLProtocol.register(host: host) { _ in .init(body: Data(#"{"data":{"hello":"world"}}"#.utf8)) }
        let result = try await client(host: host, cookie: "better-auth.session_token=abc")
            .send("query Hello($id: ID!) { hello }", variables: ["id": .string("x")], as: Hello.self)
        #expect(result.hello == "world")

        let request = try #require(StubURLProtocol.requests(for: host).first)
        #expect(request.method == "POST")
        #expect(request.headers["Cookie"] == "better-auth.session_token=abc")
        let body = try JSONSerialization.jsonObject(with: try #require(request.body)) as? [String: Any]
        #expect(body?["query"] as? String == "query Hello($id: ID!) { hello }")
        #expect((body?["variables"] as? [String: Any])?["id"] as? String == "x")
    }

    @Test func sendsNoCookieWhenSignedOut() async throws {
        let host = "gql-nocookie.test"
        StubURLProtocol.register(host: host) { _ in .init(body: Data(#"{"data":{"hello":"world"}}"#.utf8)) }
        _ = try await client(host: host).send("{ hello }", as: Hello.self)
        #expect(StubURLProtocol.requests(for: host).first?.headers["Cookie"] == nil)
    }

    @Test func throwsTheFirstErrorWithItsExtensionsCode() async {
        let host = "gql-error.test"
        StubURLProtocol.register(host: host) { _ in
            .init(body: Data(#"{"errors":[{"message":"Sign in first","extensions":{"code":"UNAUTHENTICATED"}},{"message":"second"}],"data":null}"#.utf8))
        }
        await #expect(throws: APIError.graphQL(GraphQLError(message: "Sign in first", code: "UNAUTHENTICATED"))) {
            try await client(host: host).send("{ me { id } }", as: Hello.self)
        }
    }

    @Test func validationErrorsWithA400StillCarryTheirCode() async {
        let host = "gql-400.test"
        StubURLProtocol.register(host: host) { _ in
            .init(status: 400, body: Data(#"{"errors":[{"message":"Cannot query field","extensions":{"code":"GRAPHQL_VALIDATION_FAILED"}}]}"#.utf8))
        }
        do throws(APIError) {
            _ = try await client(host: host).send("{ nope }", as: Hello.self)
            Issue.record("Expected an error")
        } catch {
            #expect(error.code == "GRAPHQL_VALIDATION_FAILED")
        }
    }

    @Test func aNonGraphQLAnswerIsAnHTTPError() async {
        let host = "gql-502.test"
        StubURLProtocol.register(host: host) { _ in .init(status: 502, headers: [:], body: Data("Bad gateway".utf8)) }
        await #expect(throws: APIError.http(statusCode: 502)) {
            try await client(host: host).send("{ hello }", as: Hello.self)
        }
    }

    @Test func anUnreachableHostIsANetworkError() async {
        // No reply registered for this host
        await #expect(throws: APIError.network(.cannotFindHost)) {
            try await client(host: "gql-unreachable.test").send("{ hello }", as: Hello.self)
        }
    }
}
