import Foundation

/// The four onboarding steps, in order. The raw value is the step's number ("Step 2 of 4").
nonisolated enum OnboardingStep: Int, CaseIterable, Hashable, Sendable {
    case interests = 1
    case dailyTime
    case reminders
    case firstSeries

    static let count = allCases.count

    /// The first step not yet finished or skipped: where the flow resumes (the Expo app's `onboarding/index.tsx`).
    static func resume(afterStepsDone stepsDone: Int) -> OnboardingStep {
        OnboardingStep(rawValue: min(max(stepsDone, 0), count - 1) + 1) ?? .firstSeries
    }

    /// The steps pushed over the first one to stand on this step, so Back walks through the earlier ones.
    var pathFromStart: [OnboardingStep] {
        Self.allCases.filter { $0.rawValue > 1 && $0.rawValue <= rawValue }
    }
}
