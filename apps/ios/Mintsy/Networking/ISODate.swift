import Foundation

/// The API's timestamps: ISO 8601, with or without fractional seconds (`2026-11-10T16:55:55.533Z`).
nonisolated enum ISODate {
    static func parse(_ string: String) -> Date? {
        if let date = try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(string) {
            return date
        }
        return try? Date.ISO8601FormatStyle().parse(string)
    }
}
