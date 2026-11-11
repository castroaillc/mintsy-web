import Foundation

/// Onboarding's wording that depends on the answers and the catalog, from the Expo app's step screens.
nonisolated enum OnboardingCopy {
    /// The interests step's button: "Pick 2 more", then "Continue · 3 selected".
    static func interestsButton(picked: Int) -> String {
        let remaining = Interest.minimum - picked
        return remaining > 0 ? "Pick \(remaining) more" : "Continue · \(picked) selected"
    }

    static func dailyTimeSubtitle(_ averages: CatalogAverages?) -> String {
        guard let averages else { return "You can change this anytime." }
        return "Episodes are about \(averages.episodeMinutes) \(averages.episodeMinutes == 1 ? "minute" : "minutes"). You can change this anytime."
    }

    /// "3 episodes a day" from the catalog's average episode length, or the goal's plain caption without one.
    static func goalCaption(_ goal: DailyGoal, _ averages: CatalogAverages?) -> String {
        guard goal != .flexible, let averages else { return goal.fallbackCaption }
        let perDay = averages.episodesPerDay(minutes: goal.minutes)
        return "\(perDay) \(perDay == 1 ? "episode" : "episodes") a day"
    }

    /// How long an average series takes at this goal. Nil when the catalog can't say.
    static func estimate(_ goal: DailyGoal, _ averages: CatalogAverages?) -> String? {
        guard goal != .flexible else { return "No pressure. Your progress is saved after every episode." }
        guard let averages else { return nil }
        let total = Double(averages.episodesPerBook * averages.episodeMinutes)
        let days = max(1, Int((total / Double(goal.minutes)).rounded(.up)))
        return "At \(goal.minutes) minutes a day, you’d finish a typical \(averages.episodesPerBook)-episode series in about \(days) \(days == 1 ? "day" : "days")."
    }

    /// The mock notification over the reminders step: a real "next" episode when the catalog has one.
    static func reminderPreview(books: [Book]) -> (title: String, body: String) {
        guard let book = books.first(where: { !$0.episodes.isEmpty }),
              let episode = book.episodes.dropFirst().first ?? book.episodes.first else {
            return ("Your next episode is ready", "Tap to start watching · 5 min")
        }
        let minutes = Int((Double(episode.durationSec) / 60).rounded())
        return ("\(SeriesFormat.episodeLabel(episode, in: book)) is ready", "\(episode.title) · \(minutes) min")
    }

    /// "Every day at 8:00 AM", "Off", or why it can't be on.
    static func reminderStatus(isOn: Bool, permission: ReminderPermission?, time: String) -> String {
        if permission == .denied { return "Notifications are off in system Settings" }
        return isOn ? "Every day at \(time)" : "Off"
    }
}
