import Foundation
import OSLog

/// The session cookies and the last known user, kept in the Keychain. An actor so the GraphQL client (off the main
/// actor) and the session store share one jar.
actor CredentialStore {
    private nonisolated static let jarKey = "cookie-jar"
    private nonisolated static let userKey = "session-user"
    private nonisolated static let log = Logger(subsystem: "com.getmintsy.app", category: "credentials")

    private let keychain: KeychainStore
    private var jar: CookieJar
    private var user: AuthUser?

    init(keychain: KeychainStore) {
        self.keychain = keychain
        jar = Self.read(CookieJar.self, key: Self.jarKey, from: keychain) ?? CookieJar()
        user = Self.read(AuthUser.self, key: Self.userKey, from: keychain)
    }

    func cookieHeader() -> String? { jar.header() }

    func hasSession() -> Bool { jar.hasSession() }

    /// The user the last session belonged to, to show while the API confirms it.
    func cachedUser() -> AuthUser? { user }

    func apply(setCookie header: String?, from url: URL) {
        let before = jar
        jar.apply(setCookie: header, from: url)
        if jar != before { write(jar, key: Self.jarKey) }
    }

    func remember(_ user: AuthUser) {
        guard user != self.user else { return }
        self.user = user
        write(user, key: Self.userKey)
    }

    /// Forgets the session on this device.
    func clear() {
        jar = CookieJar()
        user = nil
        do {
            try keychain.remove(Self.jarKey)
            try keychain.remove(Self.userKey)
        } catch {
            Self.log.error("Couldn't clear the stored session: \(error.description, privacy: .public)")
        }
    }

    private func write(_ value: some Encodable, key: String) {
        do {
            try keychain.set(JSONEncoder().encode(value), for: key)
        } catch {
            Self.log.error("Couldn't store \(key, privacy: .public): \(String(describing: error), privacy: .public)")
        }
    }

    private nonisolated static func read<T: Decodable>(_ type: T.Type, key: String, from keychain: KeychainStore) -> T? {
        do {
            guard let data = try keychain.data(for: key) else { return nil }
            return try JSONDecoder().decode(type, from: data)
        } catch {
            // Locked before first unlock, or an unreadable item: treat as signed out
            log.error("Couldn't read \(key, privacy: .public): \(String(describing: error), privacy: .public)")
            return nil
        }
    }
}
