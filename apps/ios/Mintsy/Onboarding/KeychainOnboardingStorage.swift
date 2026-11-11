import Foundation
import OSLog

/// Onboarding answers in this device's Keychain, where the Expo app kept them (SecureStore, `onboarding.<userId>`).
/// They never leave the device.
struct KeychainOnboardingStorage: OnboardingStorage {
    private static let log = Logger(subsystem: "com.getmintsy.app", category: "onboarding")

    let keychain: KeychainStore

    /// `onboarding.<userId>`, with anything but letters, digits, ".", "-" and "_" replaced.
    nonisolated static func key(for userID: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._-"))
        let safe = String(userID.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" })
        return "onboarding.\(safe)"
    }

    func read(userID: String) -> OnboardingAnswers? {
        do {
            guard let data = try keychain.data(for: Self.key(for: userID)) else { return nil }
            return try JSONDecoder().decode(OnboardingAnswers.self, from: data)
        } catch {
            Self.log.error("Couldn't read onboarding answers: \(String(describing: error), privacy: .public)")
            return nil
        }
    }

    func write(_ answers: OnboardingAnswers, userID: String) {
        do {
            try keychain.set(JSONEncoder().encode(answers), for: Self.key(for: userID))
        } catch {
            Self.log.error("Couldn't save onboarding answers: \(String(describing: error), privacy: .public)")
        }
    }

    func remove(userID: String) {
        do {
            try keychain.remove(Self.key(for: userID))
        } catch {
            Self.log.error("Couldn't remove onboarding answers: \(String(describing: error), privacy: .public)")
        }
    }
}
