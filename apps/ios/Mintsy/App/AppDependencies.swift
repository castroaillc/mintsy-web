import Foundation

/// Everything the app shares, built once from the build's configuration.
final class AppDependencies {
    let config: AppConfig
    let session: SessionStore
    let catalog: CatalogStore
    let saved: SavedStore
    let progress: ProgressStore
    let premium: PremiumStore
    let push: PushTokenService
    let graphQL: GraphQLClient

    init(config: AppConfig, keychainService: String) {
        self.config = config
        let urlSession = Self.makeURLSession()
        let credentials = CredentialStore(keychain: KeychainStore(service: keychainService))
        let auth = AuthService(baseURL: config.authURL, origin: config.origin, session: urlSession, credentials: credentials)
        graphQL = GraphQLClient(endpoint: config.graphQLURL, session: urlSession) { await credentials.cookieHeader() }
        session = SessionStore(auth: auth, credentials: credentials)
        catalog = CatalogStore(client: graphQL, hlsEnabled: config.hlsEnabled)
        saved = SavedStore(client: graphQL)
        progress = ProgressStore(client: graphQL)
        push = PushTokenService()
        premium = Self.makePremium(client: graphQL) { [catalog] in
            await catalog.load()
        }
    }

    /// The Premium store on StoreKit and the API. It starts listening for App Store transactions here, at launch.
    static func makePremium(client: GraphQLClient, reloadCatalog: @escaping () async -> Void) -> PremiumStore {
        #if DEBUG
        // Sample plans and a pretend API for screenshots and UI tests: nothing is bought and nothing is unlocked
        if UserDefaults.standard.bool(forKey: "MintsyDemoPurchases") {
            return PremiumStore(api: DemoPremiumAPI(), purchases: DemoPurchases(), reloadCatalog: reloadCatalog)
        }
        #endif
        return PremiumStore(api: GraphQLPremiumAPI(client: client), purchases: StoreKitPurchases(), reloadCatalog: reloadCatalog)
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
