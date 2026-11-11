import SwiftUI

/// The frame of an onboarding step (designs 7–10, the Expo app's `OnboardingShell`): the step bar and Skip in the
/// navigation bar, an optional hero, the step label, title and subtitle, the step's own content, and its buttons
/// pinned to the bottom. The content scrolls, so it fits short windows and large text.
struct OnboardingShell<Hero: View, Content: View, Footer: View>: View {
    let step: OnboardingStep
    let title: String
    let subtitle: String
    var showsFooterDivider = true
    /// Nil on the last step, which can't be skipped.
    var onSkip: (() -> Void)?
    @ContentBuilder let hero: Hero
    @ContentBuilder let content: Content
    @ContentBuilder let footer: Footer

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                hero
                VStack(alignment: .leading, spacing: 8) {
                    Text("Step \(step.rawValue) of \(OnboardingStep.count)")
                        .font(BrandFont.inter(13, .semibold, relativeTo: .footnote))
                        .foregroundStyle(Palette.brand)
                    Text(title)
                        .font(BrandFont.display(30, relativeTo: .largeTitle))
                        .kerning(-0.5)
                        .foregroundStyle(Palette.foreground)
                        .accessibilityAddTraits(.isHeader)
                    Text(subtitle)
                        .font(BrandFont.inter(16))
                        .lineSpacing(4)
                        .foregroundStyle(Palette.mutedForeground)
                }
                .padding(.top, 24)
                content
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
            .frame(maxWidth: 480, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(Palette.background)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 6) {
                footer
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
            .background(Palette.background)
            .overlay(alignment: .top) {
                Palette.border
                    .frame(height: 1)
                    .opacity(showsFooterDivider ? 1 : 0)
            }
        }
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                StepBar(step: step)
                    .frame(width: 168)
            }
            if let onSkip {
                ToolbarItem(placement: .primaryAction) {
                    Button("Skip", action: onSkip)
                        .foregroundStyle(Palette.mutedForeground)
                }
            }
        }
    }
}

extension OnboardingShell where Hero == EmptyView {
    init(
        step: OnboardingStep, title: String, subtitle: String, showsFooterDivider: Bool = true, onSkip: (() -> Void)? = nil,
        @ContentBuilder content: () -> Content, @ContentBuilder footer: () -> Footer
    ) {
        self.init(
            step: step, title: title, subtitle: subtitle, showsFooterDivider: showsFooterDivider, onSkip: onSkip,
            hero: { EmptyView() }, content: content, footer: footer
        )
    }
}
