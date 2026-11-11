import Foundation

/// A book and its published episodes, in order (episode n is `episodes[n - 1]`).
nonisolated struct Book: Decodable, Equatable, Hashable, Sendable, Identifiable {
    let id: String
    let title: String
    let author: String
    let category: String
    /// Solid background of the generated cover tile (hex).
    let coverTone: String
    /// Rendered cover (2:3); nil until one is published. The tile is drawn without it.
    let coverUrl: URL?
    /// Darker tint for hero backdrops and the player panel (hex).
    let tint: String
    let description: String
    let episodes: [Episode]

    init(
        id: String, title: String, author: String, category: String, coverTone: String = "#2B2850",
        coverUrl: URL? = nil, tint: String = "#2B2850", description: String = "", episodes: [Episode] = []
    ) {
        self.id = id
        self.title = title
        self.author = author
        self.category = category
        self.coverTone = coverTone
        self.coverUrl = coverUrl
        self.tint = tint
        self.description = description
        self.episodes = episodes
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, author, category, coverTone, coverUrl, tint, description, episodes
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        author = try c.decode(String.self, forKey: .author)
        category = try c.decode(String.self, forKey: .category)
        coverTone = try c.decode(String.self, forKey: .coverTone)
        coverUrl = try c.decodeIfPresent(URL.self, forKey: .coverUrl)
        tint = try c.decode(String.self, forKey: .tint)
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        episodes = try c.decode([Episode].self, forKey: .episodes)
    }

    /// The episode after `episode`, if any.
    func episode(after episode: Episode) -> Episode? {
        episodes.indices.contains(episode.number) ? episodes[episode.number] : nil
    }

    /// The episode before `episode`, if any.
    func episode(before episode: Episode) -> Episode? {
        let index = episode.number - 2
        return episodes.indices.contains(index) ? episodes[index] : nil
    }
}
