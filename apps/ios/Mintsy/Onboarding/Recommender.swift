import Foundation

/// Suggests series from the viewer's interests (the Expo app's `src/lib/recommend.ts`).
nonisolated enum Recommender {
    /// Up to `count` books with episodes: one per picked interest's category, in the order the interests were picked,
    /// then the rest of the catalog in order.
    static func picks(from books: [Book], interests: [Interest], count: Int = 3) -> [Recommendation] {
        let playable = books.filter { !$0.episodes.isEmpty }
        var picks: [Recommendation] = []
        func isPicked(_ book: Book) -> Bool { picks.contains { $0.book.id == book.id } }
        for interest in interests {
            guard picks.count < count else { break }
            if let book = playable.first(where: { $0.category == interest.category && !isPicked($0) }) {
                picks.append(Recommendation(book: book, interest: interest))
            }
        }
        for book in playable where picks.count < count && !isPicked(book) {
            picks.append(Recommendation(book: book, interest: nil))
        }
        return picks
    }
}
