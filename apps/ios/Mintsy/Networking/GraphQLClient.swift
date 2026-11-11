import Foundation

/// Minimal async GraphQL client. Sends the Better Auth session cookie that `cookieHeader` returns, the same way the
/// Expo app's `src/lib/graphql.ts` does, and throws `APIError.graphQL` with the first error's `extensions.code`.
nonisolated final class GraphQLClient: Sendable {
    let endpoint: URL
    let session: URLSession
    /// The `Cookie` header for the current session, or nil when signed out.
    let cookieHeader: @Sendable () async -> String?

    init(endpoint: URL, session: URLSession, cookieHeader: @escaping @Sendable () async -> String?) {
        self.endpoint = endpoint
        self.session = session
        self.cookieHeader = cookieHeader
    }

    private struct Body: Encodable {
        let query: String
        let variables: [String: GraphQLValue]?
    }

    private struct Response<DataType: Decodable>: Decodable {
        let data: DataType?
        let errors: [GraphQLError]?
    }

    /// Runs `query` and decodes its `data` as `T`.
    func send<T: Decodable & Sendable>(
        _ query: String,
        variables: [String: GraphQLValue]? = nil,
        as type: T.Type = T.self
    ) async throws(APIError) -> T {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let cookie = await cookieHeader() {
            request.setValue(cookie, forHTTPHeaderField: "Cookie")
        }
        do {
            request.httpBody = try JSONEncoder().encode(Body(query: query, variables: variables))
        } catch {
            throw .decoding("Couldn't encode the request: \(error)")
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError {
            throw .network(error.code)
        } catch is CancellationError {
            throw .network(.cancelled)
        } catch {
            throw .network(.unknown)
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let decoded: Response<T>
        do {
            decoded = try JSONDecoder().decode(Response<T>.self, from: data)
        } catch {
            // Apollo answers validation errors with 400 and a GraphQL body, which the decode above handles
            if !(200..<300).contains(status) { throw .http(statusCode: status) }
            throw .decoding(String(describing: error))
        }
        if let first = decoded.errors?.first { throw .graphQL(first) }
        guard let result = decoded.data else {
            throw (200..<300).contains(status) ? .decoding("The response has no data") : .http(statusCode: status)
        }
        return result
    }
}
