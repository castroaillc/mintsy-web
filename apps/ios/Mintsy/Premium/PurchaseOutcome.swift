import Foundation

/// How a purchase ended when it didn't fail. Backing out of the App Store sheet isn't an error.
nonisolated enum PurchaseOutcome: Equatable, Sendable {
    case purchased, cancelled
}
