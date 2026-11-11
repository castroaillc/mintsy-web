import Foundation
import Observation
import UIKit
import UserNotifications

/// Requests notification permission, registers with APNs, and sends the resulting device token to the
/// backend via `registerPushToken`. All failures are silent so push registration never blocks the user.
@Observable
final class PushTokenService {
    private nonisolated struct RegisterData: Decodable, Sendable {
        let registerPushToken: Bool
    }

    /// Requests notification authorization, triggers APNs registration, and sends the token to the
    /// backend. Fire-and-forget: call with `Task { }` from sign-in so it never delays catalog load.
    func register(graphQL: GraphQLClient, variant: String) async {
        let center = UNUserNotificationCenter.current()

        // Ask once; if the user has already chosen, this returns immediately with the existing decision
        guard (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) == true else {
            return
        }

        // Ask the OS for a token; the result arrives in AppDelegate via didRegisterForRemoteNotifications…
        UIApplication.shared.registerForRemoteNotifications()

        // Wait up to 10 seconds for the token to arrive through AppDelegate.pushTokenStream
        let tokenData: Data
        do {
            tokenData = try await withDeadline(.seconds(10)) {
                for await data in AppDelegate.pushTokenStream.stream {
                    return data
                }
                throw DeadlineExceeded()
            }
        } catch {
            return  // Timeout, no entitlement, or simulator — silently ignore
        }

        // Convert raw bytes to a lowercase hex string the backend expects
        let hexToken = tokenData.map { byte in
            let hex = String(byte, radix: 16, uppercase: false)
            return hex.count == 1 ? "0\(hex)" : hex
        }.joined()

        let platform = variant == "dev" ? "ios-dev" : "ios"

        // Send to the backend; silently ignore all errors (network down, not signed in, etc.)
        _ = try? await graphQL.send(
            """
            mutation RegisterPushToken($token: String!, $platform: String!) {
              registerPushToken(token: $token, platform: $platform)
            }
            """,
            variables: ["token": .string(hexToken), "platform": .string(platform)],
            as: RegisterData.self
        )
    }
}
