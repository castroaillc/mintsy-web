import Foundation

/// Something the paywall or Plan details has to tell the viewer, worded for an alert.
nonisolated struct PaywallNotice: Equatable, Sendable {
    let title: String
    let message: String

    static let nothingToRestore = PaywallNotice(
        title: "Nothing to restore",
        message: "We couldn’t find a mintsy Premium subscription for this Apple Account."
    )

    static let restored = PaywallNotice(title: "Purchases restored", message: "mintsy Premium is active on this account.")

    /// Why a purchase didn't complete. Never called for a cancelled purchase, which shows nothing.
    static func purchaseFailed(_ error: PurchasesError) -> PaywallNotice {
        switch error {
        case .pending:
            PaywallNotice(
                title: "Waiting for approval",
                message: "Your purchase needs to be approved. Premium unlocks as soon as it is."
            )
        case .notActivated:
            PaywallNotice(
                title: "Premium isn’t active yet",
                message: "The App Store took your purchase, but we couldn’t activate Premium on your account yet. We’ll keep trying. You can also tap Restore purchases in a moment."
            )
        case .unavailable:
            PaywallNotice(title: "Purchases aren’t allowed", message: "In-app purchases are turned off on this device.")
        case .accountUnavailable:
            PaywallNotice(
                title: "Purchase didn’t go through",
                message: "We couldn’t connect your mintsy account to the App Store. Check your connection and try again."
            )
        case .noPlans, .cancelled, .store:
            PaywallNotice(
                title: "Purchase didn’t go through",
                message: "Something went wrong, so your subscription didn’t start. Check your connection and try again."
            )
        }
    }

    static func restoreFailed(_ error: PurchasesError) -> PaywallNotice {
        switch error {
        case .unavailable:
            purchaseFailed(error)
        case .notActivated:
            PaywallNotice(
                title: "Couldn’t restore purchases",
                message: "We found a subscription, but couldn’t add it to this mintsy account. It may belong to another account. Check your connection and try again."
            )
        default:
            PaywallNotice(title: "Couldn’t restore purchases", message: "Check your connection and try again.")
        }
    }
}
