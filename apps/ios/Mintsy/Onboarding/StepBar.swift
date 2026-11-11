import SwiftUI

/// Onboarding's progress: one segment per step, filled up to the current one.
struct StepBar: View {
    let step: OnboardingStep

    var body: some View {
        HStack(spacing: 6) {
            ForEach(OnboardingStep.allCases, id: \.self) { item in
                RoundedRectangle(cornerRadius: 2)
                    .fill(item.rawValue <= step.rawValue ? Palette.brand : Palette.input)
                    .frame(height: 4)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Step \(step.rawValue) of \(OnboardingStep.count)")
    }
}
