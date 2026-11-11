import Foundation

/// One cookie the API set: its value and, if it has one, when it expires.
nonisolated struct StoredCookie: Codable, Equatable, Sendable {
    var value: String
    var expires: Date?

    func isLive(at now: Date) -> Bool {
        !value.isEmpty && (expires.map { $0 > now } ?? true)
    }
}
