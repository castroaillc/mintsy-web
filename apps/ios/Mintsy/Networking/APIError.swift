import Foundation

/// Why a request to the API failed.
nonisolated enum APIError: Error, Equatable, Sendable {
    /// The API answered with GraphQL errors (the first one).
    case graphQL(GraphQLError)
    /// The API answered with a status and body that aren't a GraphQL result.
    case http(statusCode: Int)
    /// No answer: offline, timed out, cancelled, the host can't be reached.
    case network(URLError.Code)
    /// An answer that doesn't have the expected shape.
    case decoding(String)

    /// `extensions.code` of a GraphQL error, if this is one.
    var code: String? {
        if case .graphQL(let error) = self { error.code } else { nil }
    }

    var isUnauthenticated: Bool { code == "UNAUTHENTICATED" }
}

extension APIError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .graphQL(let error): error.message
        case .http(let status): "The server answered with status \(status)."
        case .network(.notConnectedToInternet), .network(.networkConnectionLost): "You're offline. Check your connection and try again."
        case .network(.timedOut): "The server took too long to answer."
        case .network: "Couldn't reach the server."
        case .decoding: "The server's answer couldn't be read."
        }
    }
}
