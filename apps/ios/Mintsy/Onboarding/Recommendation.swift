import Foundation

/// A series suggested on the last onboarding step and on Home's first run, with why.
nonisolated struct Recommendation: Equatable, Sendable, Identifiable {
    let book: Book
    /// The picked interest that led to it; nil when it's simply next in the catalog.
    let interest: Interest?

    var id: String { book.id }

    /// "Because you picked Finance", or "From the catalog".
    var reason: String {
        interest.map { "Because you picked \($0.rawValue)" } ?? "From the catalog"
    }
}
