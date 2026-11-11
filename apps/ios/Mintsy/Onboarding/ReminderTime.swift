import Foundation

/// When the daily reminder fires (design 9).
nonisolated enum ReminderTime: String, CaseIterable, Codable, Sendable, Identifiable {
    case morning, lunch, evening

    var id: Self { self }

    var label: String {
        switch self {
        case .morning: "Morning"
        case .lunch: "Lunch"
        case .evening: "Evening"
        }
    }

    var hour: Int {
        switch self {
        case .morning: 8
        case .lunch: 12
        case .evening: 20
        }
    }

    var minute: Int {
        self == .lunch ? 30 : 0
    }

    /// The time of day for a notification trigger.
    var components: DateComponents {
        DateComponents(hour: hour, minute: minute)
    }

    /// "8:00 AM" or "08:00", as the locale writes times.
    func clockText(calendar: Calendar = .current, locale: Locale = .current) -> String {
        guard let date = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: .now) else { return label }
        var style = Date.FormatStyle(date: .omitted, time: .shortened)
        style.locale = locale
        style.calendar = calendar
        style.timeZone = calendar.timeZone
        return date.formatted(style)
    }
}
