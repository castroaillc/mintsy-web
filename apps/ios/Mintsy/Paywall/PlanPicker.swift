import SwiftUI

/// The plans to choose from, or their loading and unavailable states.
struct PlanPicker: View {
    let model: PaywallModel
    let onRetry: () -> Void

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 10) {
            switch model.phase {
            case .loading:
                Group {
                    PlanSkeleton()
                    PlanSkeleton()
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Loading plans")
            case .unavailable(let message):
                PlansUnavailableCard(message: message, onRetry: onRetry)
            case .ready(let offer):
                ForEach(offer.plans) { plan in
                    PlanCard(plan: plan, selection: $model.selection, badge: badge(for: plan, in: offer))
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Choose a plan")
    }

    /// Yearly is the better deal only next to a monthly plan, and the saving only shows when the store's prices give one.
    private func badge(for plan: Plan, in offer: Offer) -> String? {
        guard plan.kind == .yearly, offer.monthly != nil else { return nil }
        return offer.savingsPercent.map { "Best value · Save \($0)%" } ?? "Best value"
    }
}
