import Foundation

/// The first error in a GraphQL response. `code` is its `extensions.code`, e.g. "UNAUTHENTICATED",
/// "BAD_USER_INPUT" or "FORBIDDEN" (backend `src/graphql/schema.ts`).
nonisolated struct GraphQLError: Error, Equatable, Sendable, Decodable {
    let message: String
    let code: String?

    init(message: String, code: String?) {
        self.message = message
        self.code = code
    }

    private enum CodingKeys: String, CodingKey { case message, extensions }
    private enum ExtensionKeys: String, CodingKey { case code }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        message = try container.decodeIfPresent(String.self, forKey: .message) ?? "Unknown error"
        let extensions = try? container.nestedContainer(keyedBy: ExtensionKeys.self, forKey: .extensions)
        code = try extensions?.decodeIfPresent(String.self, forKey: .code)
    }
}
