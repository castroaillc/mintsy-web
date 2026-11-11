import UIKit

/// Lightweight app delegate used solely to relay APNs device tokens to `PushTokenService`.
/// `MintsyApp` registers it via `@UIApplicationDelegateAdaptor`.
final class AppDelegate: NSObject, UIApplicationDelegate {
    /// A shared stream that carries each raw APNs token as it arrives. `PushTokenService.register` reads from
    /// the stream side; `didRegisterForRemoteNotificationsWithDeviceToken` feeds the continuation side.
    nonisolated static let pushTokenStream = AsyncStream.makeStream(of: Data.self)

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Self.pushTokenStream.continuation.yield(deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Silently ignore — expected on the simulator and devices without the push entitlement
    }
}
