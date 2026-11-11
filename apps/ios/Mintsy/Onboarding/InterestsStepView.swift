import SwiftUI

/// Step 1 (design 7): pick at least three interests. Skipping keeps none.
struct InterestsStepView: View {
    let onNext: () -> Void

    @Environment(OnboardingStore.self) private var onboarding
    @State private var picked: [Interest] = []

    var body: some View {
        OnboardingShell(
            step: .interests,
            title: "What do you want to learn about?",
            subtitle: "Pick at least \(Interest.minimum). We’ll use them to suggest series for you.",
            onSkip: skip
        ) {
            InterestChips(picked: $picked)
                .padding(.top, 28)
        } footer: {
            Button(OnboardingCopy.interestsButton(picked: picked.count), action: save)
                .buttonStyle(.brand(height: 54))
                .disabled(picked.count < Interest.minimum)
        }
        .task { picked = onboarding.answers.interests }
    }

    private func skip() {
        onboarding.markStep(.interests)
        onNext()
    }

    private func save() {
        let picked = picked
        onboarding.markStep(.interests) { $0.interests = picked }
        onNext()
    }
}
