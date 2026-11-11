import Foundation

/// What the paywall is busy with.
nonisolated enum PaywallActivity: Equatable, Sendable {
    case purchasing, restoring
}
