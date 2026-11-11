import SwiftUI

/// Onboarding, shown once per account on a device, after sign-up or the first sign-in here: interests, daily time,
/// reminders and a first series (designs 7–10, the Expo app's `src/app/onboarding/`). It resumes at the first step
/// not finished or skipped, with the earlier ones behind it for Back. Every step but the last can be skipped.
struct OnboardingFlow: View {
    @State private var path: [OnboardingStep]

    init(resumeAt step: OnboardingStep) {
        _path = State(initialValue: step.pathFromStart)
    }

    var body: some View {
        NavigationStack(path: $path) {
            InterestsStepView(onNext: showDailyTime)
                .navigationDestination(for: OnboardingStep.self) { step in
                    switch step {
                    case .interests:
                        InterestsStepView(onNext: showDailyTime)
                    case .dailyTime:
                        DailyTimeStepView(onNext: showReminders)
                    case .reminders:
                        RemindersStepView(onNext: showFirstSeries)
                    case .firstSeries:
                        FirstSeriesStepView()
                    }
                }
        }
    }

    private func showDailyTime() {
        path = OnboardingStep.dailyTime.pathFromStart
    }

    private func showReminders() {
        path = OnboardingStep.reminders.pathFromStart
    }

    private func showFirstSeries() {
        path = OnboardingStep.firstSeries.pathFromStart
    }
}
