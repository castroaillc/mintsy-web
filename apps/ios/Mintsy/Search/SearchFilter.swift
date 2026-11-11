import Foundation

/// Which results show (design 35's All / Books / Episodes chips).
nonisolated enum SearchFilter: String, CaseIterable, Identifiable, Sendable {
    case all = "All"
    case books = "Books"
    case episodes = "Episodes"

    var id: Self { self }
}
