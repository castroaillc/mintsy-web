#if DEBUG
import Foundation

extension Book {
    /// A small book for SwiftUI previews.
    static let preview = Book(
        id: "preview-book",
        title: "The Science of Getting Rich",
        author: "Wallace D. Wattles",
        category: "Finance",
        coverTone: "#E3D6B4",
        tint: "#3A3220",
        description: "A 1910 classic arguing that wealth follows from thinking and acting in a “Certain Way.”",
        episodes: (1...5).map { number in
            Episode(
                id: "preview-book-\(number)",
                number: number,
                title: "Chapter \(number)",
                summary: "What this chapter is about, in a sentence.",
                durationSec: 280,
                transcript: [
                    TranscriptLine(startSec: 5, text: "Most of us grew up hearing some version of the same message."),
                    TranscriptLine(startSec: 8, text: "Money is the root of evil."),
                    TranscriptLine(startSec: 10, text: "Be grateful for what you have."),
                ],
                takeaways: ["Wanting more is healthy.", "Growth requires things money buys."],
                locked: number > SharedConstants.freeEpisodes
            )
        }
    )
}

extension AuthUser {
    static let preview = AuthUser(id: "preview-user", email: "reader@example.com", name: "Riley Reader", image: nil)
}

extension GraphQLClient {
    /// Points nowhere; previews don't load anything.
    static let preview = GraphQLClient(endpoint: URL(filePath: "/dev/null"), session: .shared) { nil }
}

extension CatalogStore {
    static var preview: CatalogStore { CatalogStore(books: [.preview], client: .preview) }
}

extension SessionStore {
    static var preview: SessionStore {
        let credentials = CredentialStore(keychain: KeychainStore(service: "com.getmintsy.app.preview-data"))
        let auth = AuthService(baseURL: URL(filePath: "/dev/null"), origin: "mintsy-dev://", session: .shared, credentials: credentials)
        return SessionStore(auth: auth, credentials: credentials)
    }
}
#endif
