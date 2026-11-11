import Foundation
import Observation

/// The paywall's state: the plans from the store, which one is picked, and buying or restoring.
@Observable
final class PaywallModel {
    private(set) var phase = PaywallPhase.loading
    var selection = PlanKind.yearly
    private(set) var activity: PaywallActivity?
    /// A failure (or "Nothing to restore") for an alert. Nil once it's dismissed.
    var notice: PaywallNotice?

    @ObservationIgnored private let premium: PremiumStore

    init(premium: PremiumStore) {
        self.premium = premium
    }

    static let renewalTerms = "Renews automatically unless cancelled at least 24 hours before the period ends. Manage or cancel anytime in your App Store settings."

    var offer: Offer? {
        if case .ready(let offer) = phase { offer } else { nil }
    }

    /// The picked plan, or the one the store has when it lacks the other.
    var selectedPlan: Plan? {
        guard let offer else { return nil }
        return offer.plan(selection) ?? offer.yearly ?? offer.monthly
    }

    /// "Start 7-day free trial" when the picked plan has a trial this customer can take, otherwise "Continue".
    var callToAction: String {
        Self.callToAction(for: selectedPlan)
    }

    /// The price, period and auto-renewal terms App Review requires next to the button.
    var finePrint: String {
        Self.finePrint(for: selectedPlan)
    }

    static func callToAction(for plan: Plan?) -> String {
        guard let trial = plan?.trial else { return "Continue" }
        return "Start \(trial.adjective) free trial"
    }

    static func finePrint(for plan: Plan?) -> String {
        guard let plan else { return renewalTerms }
        let price = if let trial = plan.trial {
            "Free for \(trial.noun), then \(plan.pricePerPeriod)."
        } else {
            "\(plan.pricePerPeriod)."
        }
        return "\(price) \(renewalTerms)"
    }

    /// Loads the plans. True when there's nothing to sell because the viewer already has Premium and the API agrees.
    @discardableResult
    func load() async -> Bool {
        phase = .loading
        // Already Premium, so the lock that led here is stale: refetch, and there's nothing to sell
        if premium.isPremium {
            await premium.refresh()
            if premium.isPremium { return true }
        }
        do throws(PurchasesError) {
            let offer = try await premium.loadOffer()
            if offer.plan(selection) == nil, let other = offer.plans.first {
                selection = other.kind
            }
            phase = .ready(offer)
        } catch {
            phase = .unavailable(
                error == .unavailable
                    ? "In-app purchases are turned off on this device."
                    : "We couldn’t load the plans right now."
            )
        }
        return false
    }

    /// Buys the picked plan. True when the viewer is now Premium. A cancelled purchase is false with no notice.
    func buy() async -> Bool {
        guard let plan = selectedPlan, activity == nil else { return false }
        activity = .purchasing
        defer { activity = nil }
        do throws(PurchasesError) {
            return try await premium.purchase(plan) == .purchased
        } catch {
            notice = .purchaseFailed(error)
            return false
        }
    }

    /// Restores purchases. True when the viewer is now Premium; otherwise the notice says why not.
    func restore() async -> Bool {
        guard activity == nil else { return false }
        activity = .restoring
        defer { activity = nil }
        do throws(PurchasesError) {
            if try await premium.restore() { return true }
            notice = .nothingToRestore
        } catch {
            // Backing out of the App Store's sign-in isn't a failure
            if error != .cancelled { notice = .restoreFailed(error) }
        }
        return false
    }
}
