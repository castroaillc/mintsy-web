import Foundation

/// The signed-in user, as Better Auth returns it (`user` in `/sign-in/email` and `/get-session`).
nonisolated struct AuthUser: Codable, Equatable, Sendable, Identifiable {
    let id: String
    let email: String
    let name: String
    let image: String?

    /// First letter of the name, for the avatar. Nil when the name is blank.
    var initial: String? {
        name.trimmingCharacters(in: .whitespaces).first.map { String($0).uppercased() }
    }
}
