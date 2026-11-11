import Foundation

/// The viewer's onboarding answers. They stay on this device, per account: the API has nowhere to keep them (as in
/// the Expo app, `src/lib/onboarding.tsx`).
nonisolated struct OnboardingAnswers: Codable, Equatable, Sendable {
    var onboardingComplete = false
    /// The highest step finished or skipped (0–4), so the flow resumes after it.
    var stepsDone = 0
    /// In the order they were picked.
    var interests: [Interest] = []
    var dailyGoal = DailyGoal.steady
    /// The viewer asked for the daily reminder. It only fires while notifications are allowed.
    var remindersOn = false
    var reminderTime = ReminderTime.morning
    /// The series picked on the last step with "Start Episode 1", for Home's first-run card. Nil after "Browse all".
    var firstSeriesBookID: String?

    init() {}

    private enum CodingKeys: String, CodingKey {
        case onboardingComplete, stepsDone, interests, dailyGoal, remindersOn, reminderTime, firstSeriesBookID
    }

    /// Missing keys take their defaults, and values this build doesn't know (an interest that was renamed) are dropped,
    /// so answers saved by another version never fail to load.
    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        onboardingComplete = (try? c.decode(Bool.self, forKey: .onboardingComplete)) ?? false
        stepsDone = min(max((try? c.decode(Int.self, forKey: .stepsDone)) ?? 0, 0), OnboardingStep.count)
        let names = (try? c.decode([String].self, forKey: .interests)) ?? []
        var seen: Set<Interest> = []
        interests = names.compactMap(Interest.init(rawValue:)).filter { seen.insert($0).inserted }
        dailyGoal = (try? c.decode(Int.self, forKey: .dailyGoal)).flatMap(DailyGoal.init(rawValue:)) ?? .steady
        remindersOn = (try? c.decode(Bool.self, forKey: .remindersOn)) ?? false
        reminderTime = (try? c.decode(String.self, forKey: .reminderTime)).flatMap(ReminderTime.init(rawValue:)) ?? .morning
        firstSeriesBookID = try? c.decode(String.self, forKey: .firstSeriesBookID)
    }
}
