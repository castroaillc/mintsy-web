import StoreKit
import SwiftUI

/// Deleting the account doesn't cancel an App Store subscription (App Review asks apps to say so), with the way to
/// cancel it: the App Store's manage-subscriptions sheet.
struct SubscriptionNote: View {
    @Environment(PremiumStore.self) private var premium
    @State private var isManaging = false

    var body: some View {
        let state = premium.premium
        VStack(alignment: .leading, spacing: 8) {
            Label("Deleting your account doesn’t cancel a Premium subscription.", systemImage: "exclamationmark.triangle")
                .font(BrandFont.inter(14, .semibold, relativeTo: .subheadline))
                .foregroundStyle(Palette.foreground)
            Text(detail(for: state))
                .font(BrandFont.inter(14, relativeTo: .subheadline))
                .foregroundStyle(Palette.mutedForeground)
            if !(state.active && state.isWebStore) {
                Button("Manage subscriptions", action: manage)
                    .font(BrandFont.inter(14, .semibold, relativeTo: .subheadline))
                    .foregroundStyle(Palette.brand)
                    .frame(minHeight: Metrics.minTap)
                    .buttonStyle(.plain)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: .rect(cornerRadius: 14))
        .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Palette.border) }
        .manageSubscriptionsSheet(isPresented: $isManaging)
        .onChange(of: isManaging) { _, isOpen in
            if !isOpen { refresh() }
        }
    }

    private func detail(for state: Premium) -> String {
        if state.active && state.isWebStore {
            "You subscribed on the web. Cancel it there first, or it keeps renewing."
        } else if state.active && state.willRenew {
            "You have a Premium subscription. Cancel it in the App Store first, or it keeps renewing."
        } else {
            "If you subscribed, cancel it in the App Store first."
        }
    }

    private func manage() {
        isManaging = true
    }

    /// The sheet closed: the subscription may have been cancelled or changed.
    private func refresh() {
        Task { await premium.refresh() }
    }
}
