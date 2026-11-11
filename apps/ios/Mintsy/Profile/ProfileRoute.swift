import Foundation

/// Screens pushed in the Profile tab.
nonisolated enum ProfileRoute: Hashable, Sendable {
    case settings, plan, changeEmail, changePassword, deleteAccount
}
