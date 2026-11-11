import Foundation
import UserNotifications

/// Shows a notification that arrives while the app is open, as the Expo app did (`src/lib/notifications.ts`).
final class NotificationPresenter: NSObject, UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter, willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }
}
