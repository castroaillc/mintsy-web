import Foundation

/// Fetches an episode's narrators. Never throws: nil means the request failed or timed out, `[]` is an answer
/// (locked, unknown, or an episode without voices). Either way the player plays as it always has.
nonisolated struct EpisodeVoicesLoader: Sendable {
    let client: GraphQLClient?

    private struct VoicesData: Decodable, Sendable {
        let episodeVoices: [EpisodeVoice]
    }

    func fetch(episodeID: String, timeout: Duration) async -> [EpisodeVoice]? {
        guard let client else { return nil }
        do {
            let data = try await withDeadline(timeout) {
                try await client.send(CatalogQueries.episodeVoices, variables: ["episodeId": .string(episodeID)], as: VoicesData.self)
            }
            return VoiceLogic.normalizeVoices(data.episodeVoices)
        } catch {
            return nil
        }
    }
}
