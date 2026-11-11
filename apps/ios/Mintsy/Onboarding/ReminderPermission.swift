import Foundation

/// Whether the system lets the app show notifications.
nonisolated enum ReminderPermission: Equatable, Sendable {
    /// Allowed (provisional and ephemeral count, as in the Expo app).
    case granted
    /// Refused: only the system Settings app can turn it back on.
    case denied
    /// Not asked yet.
    case undetermined
}
