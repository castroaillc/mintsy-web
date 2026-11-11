import CryptoKit
import Foundation
import Security

/// The nonce for Sign in with Apple: a random value kept by the app, whose SHA-256 goes in Apple's request.
nonisolated enum AppleNonce {
    /// 32 random bytes, hex.
    static func make() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        if status != errSecSuccess {
            // Never expected; a UUID pair is still unguessable enough for a one-time nonce
            return UUID().uuidString + UUID().uuidString
        }
        return hex(bytes)
    }

    /// Lowercase hex SHA-256, what `ASAuthorizationAppleIDRequest.nonce` takes.
    static func sha256(_ nonce: String) -> String {
        hex(Array(SHA256.hash(data: Data(nonce.utf8))))
    }

    private static func hex(_ bytes: [UInt8]) -> String {
        bytes.map { byte in
            let digits = String(byte, radix: 16)
            return digits.count == 1 ? "0" + digits : digits
        }.joined()
    }
}
