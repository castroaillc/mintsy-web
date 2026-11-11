import Foundation

/// What the paywall's plan area shows.
nonisolated enum PaywallPhase: Equatable, Sendable {
    case loading
    case ready(Offer)
    /// No plans to show, with the reason for the viewer. Try again reloads.
    case unavailable(String)
}
