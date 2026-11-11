import Foundation

/// The daily reminder as the app uses it, so tests can fake it. `LocalReminders` is the real one.
protocol ReminderScheduling: AnyObject {
    func permission() async -> ReminderPermission
    /// Shows the system's permission prompt when it hasn't been answered yet.
    func requestPermission() async -> ReminderPermission
    /// Schedules (or reschedules) the one daily reminder.
    func scheduleDaily(at time: ReminderTime) async throws
    func cancelDaily() async
}
