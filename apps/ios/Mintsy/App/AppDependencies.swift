import Foundation

/// Everything the app shares, built once from the build's configuration.
final class AppDependencies {
    let config: AppConfig
    let session: SessionStore
    let catalog: CatalogStore
    let graphQL: GraphQLClient

    init(config: AppConfig, keychainService: String) {
        self.config = config
        let urlSession = Self.makeURLSession()
        let credentials = CredentialStore(keychain: KeychainStore(service: keychainService))
        let auth = AuthService(baseURL: config.authURL, origin: config.origin, session: urlSession, credentials: credentials)
        graphQL = GraphQLClient(endpoint: config.graphQLURL, session: urlSession) { await credentials.cookieHeader() }
        session = SessionStore(auth: auth, credentials: credentials)
        catalog = CatalogStore(client: graphQL, hlsEnabled: config.hlsEnabled)
    }

    /// Cookies are handled by hand (CredentialStore keeps them in the Keychain), so the session doesn't keep its own.
    nonisolated static func makeURLSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never
        configuration.timeoutIntervalForRequest = 30
        configuration.waitsForConnectivity = false
        return URLSession(configuration: configuration)
    }
}
