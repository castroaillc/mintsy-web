import Foundation

/// What Home shows for a search and a category, by the Expo app's rules (`src/app/(app)/(tabs)/(home)/index.tsx`).
nonisolated struct HomeSections: Equatable {
    /// One horizontal row of covers.
    struct Row: Equatable, Identifiable {
        let title: String
        let books: [Book]
        var id: String { title }
    }

    static let allCategories = "All"

    let visible: [Book]
    /// The first book with episodes (books arrive sorted by `order`), when it matches and there's no search.
    let featured: Book?
    let rows: [Row]

    init(books: [Book], query: String, category: String) {
        let visible = books.filter {
            (category == Self.allCategories || $0.category == category) && SeriesFormat.matches($0, query: query)
        }
        self.visible = visible
        let first = books.first { !$0.episodes.isEmpty }
        let searching = !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        featured = first.flatMap { book in !searching && visible.contains(book) ? book : nil }

        // New books get the next-highest order, so the newest are at the end
        let newest = books.suffix(4).reversed().filter { visible.contains($0) }
        let topCategory = category == Self.allCategories ? "Finance" : category
        // Titles stay factual: there are no rankings or publish dates to back "Top" or "this week"
        rows = [
            Row(title: "More in \(topCategory)", books: visible.filter { $0.category == topCategory }),
            Row(title: "Recently added", books: Array(newest)),
        ].filter { !$0.books.isEmpty }
    }
}
