import Foundation

/// The three covers Welcome fans out: the featured book (the first with episodes, as on Home) in front, the next two
/// behind. With fewer than three books (an unseeded local backend) the mockup's covers fill in.
nonisolated struct WelcomeCovers: Equatable {
    let front: Book
    let left: Book
    let right: Book
    /// "Episode 1 of 20 · 4:52" under the fan, when the featured book is real.
    let featured: Book?

    static let samples: [Book] = [
        Book(id: "sample-0", title: "The Psychology of Money", author: "Morgan Housel", category: "Finance", coverTone: "#E7DFCF", tint: "#24382F"),
        Book(id: "sample-1", title: "The Intelligent Investor", author: "Benjamin Graham", category: "Finance", coverTone: "#1E3557", tint: "#1E2B3D"),
        Book(id: "sample-2", title: "Atomic Habits", author: "James Clear", category: "Productivity", coverTone: "#C9D6CF", tint: "#24382F"),
    ]

    init(books: [Book]) {
        let featured = books.first { !$0.episodes.isEmpty }
        let ordered = (featured.map { [$0] } ?? []) + books.filter { $0.id != featured?.id }
        let three = Array((ordered + Self.samples).prefix(3))
        front = three[0]
        left = three[1]
        right = three[2]
        self.featured = featured
    }
}
