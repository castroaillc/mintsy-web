import Foundation

/// The build variant's settings, read from Info.plist (set per configuration in Config/*.xcconfig).
nonisolated struct AppConfig: Sendable, Equatable {
    /// development, preview or production
    let variant: String
    /// The API host: GraphQL at `/graphql`, Better Auth at `/api/auth`.
    let apiURL: URL
    /// mintsy, mintsy-preview or mintsy-dev.
    let urlScheme: String
    /// Stream HLS when the API offers it.
    let hlsEnabled: Bool

    /// What Better Auth checks requests against: the app's scheme is one of the API's trusted origins.
    var origin: String { "\(urlScheme)://" }

    var graphQLURL: URL { apiURL.appending(path: "graphql") }
    var authURL: URL { apiURL.appending(path: "api/auth") }

    /// Reads and validates the values; throws when the variant has no API URL configured.
    static func load(from info: [String: Any]) throws(AppConfigError) -> AppConfig {
        let variant = info["MintsyVariant"] as? String ?? "development"
        let rawURL = (info["MintsyAPIURL"] as? String ?? "").trimmingCharacters(in: .whitespaces)
        guard !rawURL.isEmpty else { throw .missingAPIURL(variant: variant) }
        guard let url = URL(string: rawURL), let scheme = url.scheme, ["http", "https"].contains(scheme), url.host() != nil else {
            throw .invalidAPIURL(rawURL)
        }
        let urlScheme = info["MintsyURLScheme"] as? String ?? ""
        guard !urlScheme.isEmpty else { throw .missingURLScheme }
        let hls = (info["MintsyHLSEnabled"] as? String)?.uppercased() == "YES"
        return AppConfig(variant: variant, apiURL: url, urlScheme: urlScheme, hlsEnabled: hls)
    }
}
