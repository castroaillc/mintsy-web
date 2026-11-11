import Foundation
import Security

/// A Keychain call failed with this `OSStatus`.
nonisolated struct KeychainError: Error, Equatable, CustomStringConvertible {
    let status: OSStatus

    var description: String {
        let message = SecCopyErrorMessageString(status, nil) as String? ?? "unknown"
        return "Keychain error \(status): \(message)"
    }
}
