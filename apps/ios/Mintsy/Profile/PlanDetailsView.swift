import StoreKit
import SwiftUI

/// Plan details (design 50, Expo `profile/plan.tsx`): the plan, when it renews or ends, Manage subscription (the App
/// Store's sheet) and Restore purchases. On the free plan it offers Premium instead.
struct PlanDetailsView: View {
    let user: AuthUser

    @Environment(PremiumStore.self) private var premium
    @Environment(PlayerPresenter.self) private var player
    /// The store's price for the subscribed plan, e.g. "$59.99/year". Nil until (and unless) the store answers.
    @State private var price: String?
    @State private var isRestoring = false
    @State private var isManaging = false
    @State private var notice: PaywallNotice?

    var body: some View {
        let state = premium.premium
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if let status = state.status {
                    PlanSummaryCard(plan: state.planKind, status: status, price: price)
                    PlanFactsCard(premium: state, status: status, memberSince: user.memberSince)
                    // Only an App Store subscription is managed from the app
                    if state.isAppStore {
                        Button(action: manage) {
                            Label(state.willRenew ? "Manage in App Store" : "Resubscribe in App Store", systemImage: "arrow.up.forward.square")
                                .labelStyle(TrailingIconLabelStyle())
                        }
                        .buttonStyle(.brand(.outline, height: 52))
                    }
                    SubmitButton(title: "Restore purchases", isBusy: isRestoring, variant: .outline, height: 48, action: restore)
                    Text(footnote(for: state))
                        .font(BrandFont.inter(13, relativeTo: .footnote))
                        .lineSpacing(3)
                        .foregroundStyle(Palette.faint)
                } else {
                    FreePlanCard()
                    Button("Upgrade to Premium", action: upgrade)
                        .buttonStyle(.brand(height: 52))
                    SubmitButton(title: "Restore purchases", isBusy: isRestoring, variant: .outline, height: 48, action: restore)
                }
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.top, 12)
            .padding(.bottom, 32)
            .frame(maxWidth: Metrics.readableWidth)
            .frame(maxWidth: .infinity)
        }
        .background(Palette.background)
        .navigationTitle("Subscription")
        .refreshable { await premium.refresh() }
        .manageSubscriptionsSheet(isPresented: $isManaging)
        .onChange(of: isManaging) { _, isOpen in
            if !isOpen { refresh() }
        }
        .task(id: state.productId) { await loadPrice(for: state) }
        .alert(notice?.title ?? "", item: $notice) { _ in
        } message: { notice in
            Text(notice.message)
        }
    }

    private func footnote(for state: Premium) -> String {
        if state.isWebStore {
            "You subscribed on the web, so your plan is managed there and not in the App Store."
        } else if state.isAppStore {
            "Switching plans, changing payment or cancelling happens in your App Store subscriptions. If you cancel, Premium stays on until the end of the period you’ve paid for."
        } else {
            "This plan isn’t billed through the App Store, so it can’t be managed here."
        }
    }

    /// The price comes from the store through its products, matched to the subscribed product.
    private func loadPrice(for state: Premium) async {
        price = nil
        guard state.active, state.isAppStore, let kind = state.planKind else { return }
        guard let plan = try? await premium.loadOffer().plan(kind), plan.productID == state.productId else { return }
        price = plan.pricePerPeriod
    }

    private func upgrade() {
        player.showPaywall()
    }

    /// The manage-subscriptions sheet closed: the subscription may have been cancelled or changed.
    private func refresh() {
        Task { await premium.refresh() }
    }

    private func manage() {
        isManaging = true
    }

    private func restore() {
        isRestoring = true
        Task {
            do throws(PurchasesError) {
                notice = try await premium.restore() ? .restored : .nothingToRestore
            } catch {
                if error != .cancelled { notice = .restoreFailed(error) }
            }
            isRestoring = false
        }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        PlanDetailsView(user: .preview)
    }
    .environment(PremiumStore.preview)
    .environment(PlayerPresenter())
    .preferredColorScheme(.dark)
}
#endif
