import Foundation
import UserNotifications

/// The daily "next episode" nudge as a local notification, scheduled on this device (the Expo app's
/// `src/lib/reminders.ts`). Nothing is registered with the API: there's no server push in the native app yet.
final class LocalReminders: ReminderScheduling {
    static let dailyIdentifier = "daily-reminder"

    private let center: UNUserNotificationCenter

    init(center: UNUserNotificationCenter = .current()) {
        self.center = center
    }

    func permission() async -> ReminderPermission {
        Self.permission(for: await center.notificationSettings().authorizationStatus)
    }

    func requestPermission() async -> ReminderPermission {
        _ = try? await center.requestAuthorization(options: [.alert, .badge, .sound])
        return await permission()
    }

    func scheduleDaily(at time: ReminderTime) async throws {
        await cancelDaily()
        let content = UNMutableNotificationContent()
        content.title = String(localized: "Your next episode is ready")
        content.body = String(localized: "Five minutes is all it takes. Pick up where you left off.")
        content.sound = .default
        let trigger = UNCalendarNotificationTrigger(dateMatching: time.components, repeats: true)
        try await center.add(UNNotificationRequest(identifier: Self.dailyIdentifier, content: content, trigger: trigger))
    }

    func cancelDaily() async {
        center.removePendingNotificationRequests(withIdentifiers: [Self.dailyIdentifier])
    }

    nonisolated static func permission(for status: UNAuthorizationStatus) -> ReminderPermission {
        switch status {
        case .authorized, .provisional, .ephemeral: .granted
        case .denied: .denied
        case .notDetermined: .undetermined
        @unknown default: .undetermined
        }
    }
}
