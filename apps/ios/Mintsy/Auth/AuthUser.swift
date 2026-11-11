import Foundation

/// The signed-in user, as Better Auth returns it (`user` in `/sign-in/email`, `/sign-up/email` and `/get-session`).
nonisolated struct AuthUser: Codable, Equatable, Sendable, Identifiable {
    let id: String
    let email: String
    let name: String
    let image: String?
    /// ISO 8601, when the account was made. Nil in sessions stored before it was read.
    var createdAt: String?

    init(id: String, email: String, name: String, image: String?, createdAt: String? = nil) {
        self.id = id
        self.email = email
        self.name = name
        self.image = image
        self.createdAt = createdAt
    }

    /// First letter of the name, for the avatar. Nil when the name is blank.
    var initial: String? {
        name.trimmingCharacters(in: .whitespaces).first.map { String($0).uppercased() }
    }

    /// When the account was made, for "Member since".
    var memberSince: Date? {
        createdAt.flatMap(ISODate.parse)
    }
}
