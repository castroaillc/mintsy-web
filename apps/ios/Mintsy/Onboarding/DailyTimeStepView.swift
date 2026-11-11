import SwiftUI

/// Step 2 (design 8): how much time a day. The captions and the estimate come from the catalog's real episode
/// lengths, and fall back to plain wording without them.
struct DailyTimeStepView: View {
    let onNext: () -> Void

    @Environment(OnboardingStore.self) private var onboarding
    @Environment(CatalogStore.self) private var catalog
    @State private var goal = DailyGoal.steady

    var body: some View {
        let averages = CatalogAverages(books: catalog.books)
        OnboardingShell(
            step: .dailyTime,
            title: "How much time do you have each day?",
            subtitle: OnboardingCopy.dailyTimeSubtitle(averages),
            onSkip: skip
        ) {
            VStack(spacing: 12) {
                ForEach(DailyGoal.allCases) { option in
                    DailyGoalCard(goal: option, caption: OnboardingCopy.goalCaption(option, averages), selection: $goal)
                }
            }
            .padding(.top, 28)
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Daily goal")

            if let estimate = OnboardingCopy.estimate(goal, averages) {
                Text(estimate)
                    .font(BrandFont.inter(14, relativeTo: .subheadline))
                    .lineSpacing(3)
                    .foregroundStyle(Palette.secondaryForeground)
                    .padding(.top, 20)
            }
        } footer: {
            Button("Continue", action: save)
                .buttonStyle(.brand(height: 54))
        }
        .task { goal = onboarding.answers.dailyGoal }
    }

    private func skip() {
        onboarding.markStep(.dailyTime)
        onNext()
    }

    private func save() {
        let goal = goal
        onboarding.markStep(.dailyTime) { $0.dailyGoal = goal }
        onNext()
    }
}
